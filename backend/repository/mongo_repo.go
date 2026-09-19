package repository

import (
	"context"
	"errors"
	"log"
	"sync"
	"time"

	"livepoll/backend/models"

	"go.mongodb.org/mongo-driver/bson"
	"go.mongodb.org/mongo-driver/bson/primitive"
	"go.mongodb.org/mongo-driver/mongo"
	"go.mongodb.org/mongo-driver/mongo/options"
)

var (
	ErrUserNotFound = errors.New("user not found")
	ErrUserExists   = errors.New("user with this email already exists")
	ErrPollNotFound = errors.New("poll not found")
)

type MongoRepository interface {
	// User
	CreateUser(ctx context.Context, user *models.User) error
	FindUserByEmail(ctx context.Context, email string) (*models.User, error)
	FindUserByID(ctx context.Context, id primitive.ObjectID) (*models.User, error)

	// Poll
	CreatePoll(ctx context.Context, poll *models.Poll) error
	FindPollByID(ctx context.Context, id primitive.ObjectID) (*models.Poll, error)
	FindPollByCode(ctx context.Context, code string) (*models.Poll, error)
	FindPollsByCreator(ctx context.Context, creatorID primitive.ObjectID) ([]models.Poll, error)
	UpdatePollStatus(ctx context.Context, pollID primitive.ObjectID, isClosed bool) error
	UpdatePollTotalVotes(ctx context.Context, pollID primitive.ObjectID, totalVotes int64) error
	DeletePoll(ctx context.Context, pollID primitive.ObjectID, creatorID primitive.ObjectID) error

	// Vote audit log
	RecordVoteAudit(ctx context.Context, vote *models.Vote) error

	IsConnected() bool
}

type realMongoRepo struct {
	client *mongo.Client
	db     *mongo.Database
	users  *mongo.Collection
	polls  *mongo.Collection
	votes  *mongo.Collection
}

func NewMongoRepository(uri, dbName string) MongoRepository {
	ctx, cancel := context.WithTimeout(context.Background(), 2*time.Second)
	defer cancel()

	clientOpts := options.Client().ApplyURI(uri)
	client, err := mongo.Connect(ctx, clientOpts)
	if err != nil {
		log.Printf("⚠️ [MongoDB] Could not initialize MongoDB client: %v. Activating resilient in-memory repository.", err)
		return newInMemoryMongoRepo()
	}

	if err := client.Ping(ctx, nil); err != nil {
		log.Printf("⚠️ [MongoDB] Could not ping MongoDB at %s: %v. Activating resilient in-memory repository.", uri, err)
		return newInMemoryMongoRepo()
	}

	db := client.Database(dbName)
	usersColl := db.Collection("users")
	pollsColl := db.Collection("polls")
	votesColl := db.Collection("votes")

	// Ensure unique index on user email
	_, _ = usersColl.Indexes().CreateOne(context.Background(), mongo.IndexModel{
		Keys:    bson.D{{Key: "email", Value: 1}},
		Options: options.Index().SetUnique(true),
	})

	// Ensure unique index on poll code
	_, _ = pollsColl.Indexes().CreateOne(context.Background(), mongo.IndexModel{
		Keys:    bson.D{{Key: "code", Value: 1}},
		Options: options.Index().SetUnique(true),
	})

	log.Printf("✅ [MongoDB] Connected successfully to database '%s'", dbName)

	return &realMongoRepo{
		client: client,
		db:     db,
		users:  usersColl,
		polls:  pollsColl,
		votes:  votesColl,
	}
}

func (r *realMongoRepo) IsConnected() bool {
	return true
}

func (r *realMongoRepo) CreateUser(ctx context.Context, user *models.User) error {
	user.ID = primitive.NewObjectID()
	user.CreatedAt = time.Now()
	user.UpdatedAt = time.Now()

	_, err := r.users.InsertOne(ctx, user)
	if mongo.IsDuplicateKeyError(err) {
		return ErrUserExists
	}
	return err
}

func (r *realMongoRepo) FindUserByEmail(ctx context.Context, email string) (*models.User, error) {
	var user models.User
	err := r.users.FindOne(ctx, bson.M{"email": email}).Decode(&user)
	if err != nil {
		if errors.Is(err, mongo.ErrNoDocuments) {
			return nil, ErrUserNotFound
		}
		return nil, err
	}
	return &user, nil
}

func (r *realMongoRepo) FindUserByID(ctx context.Context, id primitive.ObjectID) (*models.User, error) {
	var user models.User
	err := r.users.FindOne(ctx, bson.M{"_id": id}).Decode(&user)
	if err != nil {
		if errors.Is(err, mongo.ErrNoDocuments) {
			return nil, ErrUserNotFound
		}
		return nil, err
	}
	return &user, nil
}

func (r *realMongoRepo) CreatePoll(ctx context.Context, poll *models.Poll) error {
	if poll.ID.IsZero() {
		poll.ID = primitive.NewObjectID()
	}
	poll.CreatedAt = time.Now()
	poll.UpdatedAt = time.Now()

	_, err := r.polls.InsertOne(ctx, poll)
	return err
}

func (r *realMongoRepo) FindPollByID(ctx context.Context, id primitive.ObjectID) (*models.Poll, error) {
	var poll models.Poll
	err := r.polls.FindOne(ctx, bson.M{"_id": id}).Decode(&poll)
	if err != nil {
		if errors.Is(err, mongo.ErrNoDocuments) {
			return nil, ErrPollNotFound
		}
		return nil, err
	}
	return &poll, nil
}

func (r *realMongoRepo) FindPollByCode(ctx context.Context, code string) (*models.Poll, error) {
	var poll models.Poll
	err := r.polls.FindOne(ctx, bson.M{"code": code}).Decode(&poll)
	if err != nil {
		if errors.Is(err, mongo.ErrNoDocuments) {
			return nil, ErrPollNotFound
		}
		return nil, err
	}
	return &poll, nil
}

func (r *realMongoRepo) FindPollsByCreator(ctx context.Context, creatorID primitive.ObjectID) ([]models.Poll, error) {
	cursor, err := r.polls.Find(ctx, bson.M{"creator_id": creatorID}, options.Find().SetSort(bson.D{{Key: "created_at", Value: -1}}))
	if err != nil {
		return nil, err
	}
	defer cursor.Close(ctx)

	var polls []models.Poll
	if err := cursor.All(ctx, &polls); err != nil {
		return nil, err
	}
	return polls, nil
}

func (r *realMongoRepo) UpdatePollStatus(ctx context.Context, pollID primitive.ObjectID, isClosed bool) error {
	_, err := r.polls.UpdateOne(ctx, bson.M{"_id": pollID}, bson.M{
		"$set": bson.M{
			"settings.is_closed": isClosed,
			"updated_at":         time.Now(),
		},
	})
	return err
}

func (r *realMongoRepo) UpdatePollTotalVotes(ctx context.Context, pollID primitive.ObjectID, totalVotes int64) error {
	_, err := r.polls.UpdateOne(ctx, bson.M{"_id": pollID}, bson.M{
		"$set": bson.M{
			"total_votes": totalVotes,
			"updated_at":  time.Now(),
		},
	})
	return err
}

func (r *realMongoRepo) DeletePoll(ctx context.Context, pollID primitive.ObjectID, creatorID primitive.ObjectID) error {
	result, err := r.polls.DeleteOne(ctx, bson.M{"_id": pollID, "creator_id": creatorID})
	if err != nil {
		return err
	}
	if result.DeletedCount == 0 {
		return ErrPollNotFound
	}
	// Also clean up votes
	_, _ = r.votes.DeleteMany(ctx, bson.M{"poll_id": pollID})
	return nil
}

func (r *realMongoRepo) RecordVoteAudit(ctx context.Context, vote *models.Vote) error {
	if vote.ID.IsZero() {
		vote.ID = primitive.NewObjectID()
	}
	vote.CreatedAt = time.Now()
	_, err := r.votes.InsertOne(ctx, vote)
	return err
}

// Resilient thread-safe in-memory Mongo fallback
type inMemoryMongoRepo struct {
	mu    sync.RWMutex
	users map[string]*models.User
	polls map[string]*models.Poll
	votes []*models.Vote
}

func newInMemoryMongoRepo() MongoRepository {
	return &inMemoryMongoRepo{
		users: make(map[string]*models.User),
		polls: make(map[string]*models.Poll),
		votes: make([]*models.Vote, 0),
	}
}

func (m *inMemoryMongoRepo) IsConnected() bool {
	return false
}

func (m *inMemoryMongoRepo) CreateUser(ctx context.Context, user *models.User) error {
	m.mu.Lock()
	defer m.mu.Unlock()

	for _, u := range m.users {
		if u.Email == user.Email {
			return ErrUserExists
		}
	}

	user.ID = primitive.NewObjectID()
	user.CreatedAt = time.Now()
	user.UpdatedAt = time.Now()
	m.users[user.ID.Hex()] = user
	return nil
}

func (m *inMemoryMongoRepo) FindUserByEmail(ctx context.Context, email string) (*models.User, error) {
	m.mu.RLock()
	defer m.mu.RUnlock()

	for _, u := range m.users {
		if u.Email == email {
			copied := *u
			return &copied, nil
		}
	}
	return nil, ErrUserNotFound
}

func (m *inMemoryMongoRepo) FindUserByID(ctx context.Context, id primitive.ObjectID) (*models.User, error) {
	m.mu.RLock()
	defer m.mu.RUnlock()

	u, ok := m.users[id.Hex()]
	if !ok {
		return nil, ErrUserNotFound
	}
	copied := *u
	return &copied, nil
}

func (m *inMemoryMongoRepo) CreatePoll(ctx context.Context, poll *models.Poll) error {
	m.mu.Lock()
	defer m.mu.Unlock()

	if poll.ID.IsZero() {
		poll.ID = primitive.NewObjectID()
	}
	poll.CreatedAt = time.Now()
	poll.UpdatedAt = time.Now()
	m.polls[poll.ID.Hex()] = poll
	return nil
}

func (m *inMemoryMongoRepo) FindPollByID(ctx context.Context, id primitive.ObjectID) (*models.Poll, error) {
	m.mu.RLock()
	defer m.mu.RUnlock()

	p, ok := m.polls[id.Hex()]
	if !ok {
		return nil, ErrPollNotFound
	}
	copied := *p
	return &copied, nil
}

func (m *inMemoryMongoRepo) FindPollByCode(ctx context.Context, code string) (*models.Poll, error) {
	m.mu.RLock()
	defer m.mu.RUnlock()

	for _, p := range m.polls {
		if p.Code == code {
			copied := *p
			return &copied, nil
		}
	}
	return nil, ErrPollNotFound
}

func (m *inMemoryMongoRepo) FindPollsByCreator(ctx context.Context, creatorID primitive.ObjectID) ([]models.Poll, error) {
	m.mu.RLock()
	defer m.mu.RUnlock()

	var result []models.Poll
	for _, p := range m.polls {
		if p.CreatorID == creatorID {
			result = append(result, *p)
		}
	}
	return result, nil
}

func (m *inMemoryMongoRepo) UpdatePollStatus(ctx context.Context, pollID primitive.ObjectID, isClosed bool) error {
	m.mu.Lock()
	defer m.mu.Unlock()

	p, ok := m.polls[pollID.Hex()]
	if !ok {
		return ErrPollNotFound
	}
	p.Settings.IsClosed = isClosed
	p.UpdatedAt = time.Now()
	return nil
}

func (m *inMemoryMongoRepo) UpdatePollTotalVotes(ctx context.Context, pollID primitive.ObjectID, totalVotes int64) error {
	m.mu.Lock()
	defer m.mu.Unlock()

	p, ok := m.polls[pollID.Hex()]
	if !ok {
		return ErrPollNotFound
	}
	p.TotalVotes = totalVotes
	p.UpdatedAt = time.Now()
	return nil
}

func (m *inMemoryMongoRepo) DeletePoll(ctx context.Context, pollID primitive.ObjectID, creatorID primitive.ObjectID) error {
	m.mu.Lock()
	defer m.mu.Unlock()

	p, ok := m.polls[pollID.Hex()]
	if !ok || p.CreatorID != creatorID {
		return ErrPollNotFound
	}
	delete(m.polls, pollID.Hex())
	return nil
}

func (m *inMemoryMongoRepo) RecordVoteAudit(ctx context.Context, vote *models.Vote) error {
	m.mu.Lock()
	defer m.mu.Unlock()

	if vote.ID.IsZero() {
		vote.ID = primitive.NewObjectID()
	}
	vote.CreatedAt = time.Now()
	m.votes = append(m.votes, vote)
	return nil
}
