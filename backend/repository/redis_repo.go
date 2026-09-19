package repository

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"log"
	"strconv"
	"strings"
	"sync"
	"time"

	"livepoll/backend/models"

	"github.com/redis/go-redis/v9"
)

var ErrAlreadyVoted = errors.New("voter has already submitted a vote for this poll")

type RedisRepository interface {
	RecordVote(ctx context.Context, pollID string, voterHash string, optionIDs []string) (map[string]int64, int64, error)
	HasVoted(ctx context.Context, pollID string, voterHash string) (bool, error)
	GetPollCounts(ctx context.Context, pollID string) (map[string]int64, int64, error)
	ResetPollCounts(ctx context.Context, pollID string) error
	PublishEvent(ctx context.Context, pollID string, event *models.LivePollUpdate) error
	SubscribeToPoll(ctx context.Context, pollID string) (<-chan string, func(), error)
	IsConnected() bool
}

// Real Redis client implementation
type realRedisRepo struct {
	client *redis.Client
}

func NewRedisRepository(redisURI, password string) RedisRepository {
	trimmedURI := strings.TrimSpace(redisURI)

	// If Upstash endpoint without rediss:// prefix, automatically format as TLS URL
	if strings.Contains(trimmedURI, "upstash.io") && !strings.HasPrefix(trimmedURI, "rediss://") {
		cleanAddr := strings.TrimPrefix(trimmedURI, "redis://")
		if password != "" {
			trimmedURI = fmt.Sprintf("rediss://default:%s@%s", password, cleanAddr)
		} else {
			trimmedURI = fmt.Sprintf("rediss://%s", cleanAddr)
		}
	}

	opts, err := redis.ParseURL(trimmedURI)
	if err != nil {
		// Treat as address host:port
		opts = &redis.Options{
			Addr:     trimmedURI,
			Password: password,
			DB:       0,
		}
	} else if password != "" {
		opts.Password = password
	}

	client := redis.NewClient(opts)
	ctx, cancel := context.WithTimeout(context.Background(), 2*time.Second)
	defer cancel()

	if err := client.Ping(ctx).Err(); err != nil {
		log.Printf("⚠️ [Redis] Could not connect to Redis at %s: %v. Activating resilient in-memory real-time engine.", redisURI, err)
		return newInMemoryRedisRepo()
	}

	log.Printf("✅ [Redis] Connected successfully to Redis at %s", opts.Addr)
	return &realRedisRepo{client: client}
}

func (r *realRedisRepo) IsConnected() bool {
	return true
}

func (r *realRedisRepo) countsKey(pollID string) string {
	return fmt.Sprintf("poll:%s:counts", pollID)
}

func (r *realRedisRepo) votersKey(pollID string) string {
	return fmt.Sprintf("poll:%s:voters", pollID)
}

func (r *realRedisRepo) channelKey(pollID string) string {
	return fmt.Sprintf("poll_events:%s", pollID)
}

func (r *realRedisRepo) HasVoted(ctx context.Context, pollID string, voterHash string) (bool, error) {
	return r.client.SIsMember(ctx, r.votersKey(pollID), voterHash).Result()
}

func (r *realRedisRepo) RecordVote(ctx context.Context, pollID string, voterHash string, optionIDs []string) (map[string]int64, int64, error) {
	votersKey := r.votersKey(pollID)
	countsKey := r.countsKey(pollID)

	// Step 1: Atomic duplicate prevention via SADD
	added, err := r.client.SAdd(ctx, votersKey, voterHash).Result()
	if err != nil {
		return nil, 0, fmt.Errorf("redis voter check failed: %w", err)
	}
	if added == 0 {
		return nil, 0, ErrAlreadyVoted
	}

	// Step 2: Atomic increment via Pipeline
	pipe := r.client.TxPipeline()
	for _, optID := range optionIDs {
		pipe.HIncrBy(ctx, countsKey, optID, 1)
	}
	pipe.HGetAll(ctx, countsKey)

	cmders, err := pipe.Exec(ctx)
	if err != nil {
		// Rollback voter add if increment failed
		_ = r.client.SRem(ctx, votersKey, voterHash).Err()
		return nil, 0, fmt.Errorf("redis increment failed: %w", err)
	}

	// Last result is HGetAll
	hgetAllCmd := cmders[len(cmders)-1].(*redis.MapStringStringCmd)
	rawCounts, err := hgetAllCmd.Result()
	if err != nil {
		return nil, 0, err
	}

	counts := make(map[string]int64)
	var totalVotes int64
	for k, v := range rawCounts {
		cnt, _ := strconv.ParseInt(v, 10, 64)
		counts[k] = cnt
		totalVotes += cnt
	}

	return counts, totalVotes, nil
}

func (r *realRedisRepo) GetPollCounts(ctx context.Context, pollID string) (map[string]int64, int64, error) {
	countsKey := r.countsKey(pollID)
	rawCounts, err := r.client.HGetAll(ctx, countsKey).Result()
	if err != nil {
		return nil, 0, err
	}

	counts := make(map[string]int64)
	var total int64
	for k, v := range rawCounts {
		cnt, _ := strconv.ParseInt(v, 10, 64)
		counts[k] = cnt
		total += cnt
	}
	return counts, total, nil
}

func (r *realRedisRepo) ResetPollCounts(ctx context.Context, pollID string) error {
	pipe := r.client.TxPipeline()
	pipe.Del(ctx, r.countsKey(pollID))
	pipe.Del(ctx, r.votersKey(pollID))
	_, err := pipe.Exec(ctx)
	return err
}

func (r *realRedisRepo) PublishEvent(ctx context.Context, pollID string, event *models.LivePollUpdate) error {
	data, err := json.Marshal(event)
	if err != nil {
		return err
	}
	return r.client.Publish(ctx, r.channelKey(pollID), data).Err()
}

func (r *realRedisRepo) SubscribeToPoll(ctx context.Context, pollID string) (<-chan string, func(), error) {
	pubsub := r.client.Subscribe(ctx, r.channelKey(pollID))
	msgChan := make(chan string, 50)

	go func() {
		ch := pubsub.Channel()
		for msg := range ch {
			msgChan <- msg.Payload
		}
		close(msgChan)
	}()

	cleanup := func() {
		_ = pubsub.Close()
	}

	return msgChan, cleanup, nil
}

// In-memory fallback implementation with exact same semantics
type inMemoryRedisRepo struct {
	mu          sync.RWMutex
	voters      map[string]map[string]bool // pollID -> voterHash -> bool
	counts      map[string]map[string]int64 // pollID -> optionID -> count
	subscribers map[string][]chan string
}

func newInMemoryRedisRepo() RedisRepository {
	return &inMemoryRedisRepo{
		voters:      make(map[string]map[string]bool),
		counts:      make(map[string]map[string]int64),
		subscribers: make(map[string][]chan string),
	}
}

func (m *inMemoryRedisRepo) IsConnected() bool {
	return false
}

func (m *inMemoryRedisRepo) HasVoted(ctx context.Context, pollID string, voterHash string) (bool, error) {
	m.mu.RLock()
	defer m.mu.RUnlock()
	pollVoters, ok := m.voters[pollID]
	if !ok {
		return false, nil
	}
	return pollVoters[voterHash], nil
}

func (m *inMemoryRedisRepo) RecordVote(ctx context.Context, pollID string, voterHash string, optionIDs []string) (map[string]int64, int64, error) {
	m.mu.Lock()
	defer m.mu.Unlock()

	pollVoters, ok := m.voters[pollID]
	if !ok {
		pollVoters = make(map[string]bool)
		m.voters[pollID] = pollVoters
	}

	if pollVoters[voterHash] {
		return nil, 0, ErrAlreadyVoted
	}
	pollVoters[voterHash] = true

	pollCounts, ok := m.counts[pollID]
	if !ok {
		pollCounts = make(map[string]int64)
		m.counts[pollID] = pollCounts
	}

	for _, optID := range optionIDs {
		pollCounts[optID]++
	}

	countsCopy := make(map[string]int64)
	var total int64
	for k, v := range pollCounts {
		countsCopy[k] = v
		total += v
	}

	return countsCopy, total, nil
}

func (m *inMemoryRedisRepo) GetPollCounts(ctx context.Context, pollID string) (map[string]int64, int64, error) {
	m.mu.RLock()
	defer m.mu.RUnlock()
	pollCounts, ok := m.counts[pollID]
	countsCopy := make(map[string]int64)
	if !ok {
		return countsCopy, 0, nil
	}
	var total int64
	for k, v := range pollCounts {
		countsCopy[k] = v
		total += v
	}
	return countsCopy, total, nil
}

func (m *inMemoryRedisRepo) ResetPollCounts(ctx context.Context, pollID string) error {
	m.mu.Lock()
	defer m.mu.Unlock()
	delete(m.counts, pollID)
	delete(m.voters, pollID)
	return nil
}

func (m *inMemoryRedisRepo) PublishEvent(ctx context.Context, pollID string, event *models.LivePollUpdate) error {
	m.mu.RLock()
	defer m.mu.RUnlock()

	data, err := json.Marshal(event)
	if err != nil {
		return err
	}

	subs := m.subscribers[pollID]
	for _, ch := range subs {
		select {
		case ch <- string(data):
		default:
		}
	}
	return nil
}

func (m *inMemoryRedisRepo) SubscribeToPoll(ctx context.Context, pollID string) (<-chan string, func(), error) {
	m.mu.Lock()
	defer m.mu.Unlock()

	ch := make(chan string, 50)
	m.subscribers[pollID] = append(m.subscribers[pollID], ch)

	cleanup := func() {
		m.mu.Lock()
		defer m.mu.Unlock()
		subs := m.subscribers[pollID]
		for i, c := range subs {
			if c == ch {
				m.subscribers[pollID] = append(subs[:i], subs[i+1:]...)
				close(ch)
				break
			}
		}
	}

	return ch, cleanup, nil
}
