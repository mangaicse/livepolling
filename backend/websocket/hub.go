package websocket

import (
	"context"
	"encoding/json"
	"log"
	"sync"
	"time"

	"livepoll/backend/models"
	"livepoll/backend/repository"
)

type Hub struct {
	mu           sync.RWMutex
	rooms        map[string]map[*Client]bool // pollID -> client set
	subCancels   map[string]func()           // pollID -> redis unsub cancel func
	broadcast    chan broadcastMessage
	register     chan *Client
	unregister   chan *Client
	redisRepo    repository.RedisRepository
}

type broadcastMessage struct {
	pollID  string
	message []byte
}

func NewHub(redisRepo repository.RedisRepository) *Hub {
	return &Hub{
		rooms:      make(map[string]map[*Client]bool),
		subCancels: make(map[string]func()),
		broadcast:  make(chan broadcastMessage, 256),
		register:   make(chan *Client),
		unregister: make(chan *Client),
		redisRepo:  redisRepo,
	}
}

func (h *Hub) Run() {
	for {
		select {
		case client := <-h.register:
			h.mu.Lock()
			clients, ok := h.rooms[client.PollID]
			if !ok {
				clients = make(map[*Client]bool)
				h.rooms[client.PollID] = clients
				// Start Redis subscriber for this poll room
				h.subscribeRedis(client.PollID)
			}
			clients[client] = true
			viewerCount := len(clients)
			h.mu.Unlock()

			// Broadcast updated viewer count to room
			h.BroadcastViewerCount(client.PollID, viewerCount)

		case client := <-h.unregister:
			h.mu.Lock()
			clients, ok := h.rooms[client.PollID]
			if ok {
				if _, found := clients[client]; found {
					delete(clients, client)
					close(client.Send)
				}
				viewerCount := len(clients)
				if viewerCount == 0 {
					delete(h.rooms, client.PollID)
					if cancel, hasCancel := h.subCancels[client.PollID]; hasCancel {
						cancel()
						delete(h.subCancels, client.PollID)
					}
				}
				h.mu.Unlock()
				if viewerCount > 0 {
					h.BroadcastViewerCount(client.PollID, viewerCount)
				}
			} else {
				h.mu.Unlock()
			}

		case bm := <-h.broadcast:
			h.mu.RLock()
			clients := h.rooms[bm.pollID]
			for client := range clients {
				select {
				case client.Send <- bm.message:
				default:
					close(client.Send)
					delete(clients, client)
				}
			}
			h.mu.RUnlock()
		}
	}
}

func (h *Hub) subscribeRedis(pollID string) {
	msgChan, cancel, err := h.redisRepo.SubscribeToPoll(context.Background(), pollID)
	if err != nil {
		log.Printf("⚠️ [WS Hub] Error subscribing to Redis for poll %s: %v", pollID, err)
		return
	}
	h.subCancels[pollID] = cancel

	go func() {
		for payload := range msgChan {
			h.broadcast <- broadcastMessage{
				pollID:  pollID,
				message: []byte(payload),
			}
		}
	}()
}

func (h *Hub) BroadcastViewerCount(pollID string, count int) {
	update := models.LivePollUpdate{
		Type:        "VIEWER_COUNT",
		PollID:      pollID,
		ViewerCount: count,
		Timestamp:   time.Now(),
	}
	data, _ := json.Marshal(update)
	h.broadcast <- broadcastMessage{
		pollID:  pollID,
		message: data,
	}
}

func (h *Hub) BroadcastDirect(pollID string, message []byte) {
	h.broadcast <- broadcastMessage{
		pollID:  pollID,
		message: message,
	}
}

func (h *Hub) GetViewerCount(pollID string) int {
	h.mu.RLock()
	defer h.mu.RUnlock()
	return len(h.rooms[pollID])
}
