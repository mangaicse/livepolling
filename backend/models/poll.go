package models

import (
	"time"

	"go.mongodb.org/mongo-driver/bson/primitive"
)

type Option struct {
	ID        string `json:"id" bson:"id"`
	Text      string `json:"text" bson:"text"`
	VoteCount int64  `json:"vote_count" bson:"vote_count"`
}

type PollSettings struct {
	AllowMultiple         bool `json:"allow_multiple" bson:"allow_multiple"`
	ShowResultsBeforeVote bool `json:"show_results_before_vote" bson:"show_results_before_vote"`
	IsClosed              bool `json:"is_closed" bson:"is_closed"`
}

type Poll struct {
	ID          primitive.ObjectID `json:"id" bson:"_id,omitempty"`
	CreatorID   primitive.ObjectID `json:"creator_id" bson:"creator_id"`
	Title       string             `json:"title" bson:"title"`
	Description string             `json:"description" bson:"description"`
	Code        string             `json:"code" bson:"code"` // 6-character short access code (e.g. "POLL42")
	Options     []Option           `json:"options" bson:"options"`
	Settings    PollSettings       `json:"settings" bson:"settings"`
	TotalVotes  int64              `json:"total_votes" bson:"total_votes"`
	CreatedAt   time.Time          `json:"created_at" bson:"created_at"`
	UpdatedAt   time.Time          `json:"updated_at" bson:"updated_at"`
}

type CreatePollOption struct {
	Text string `json:"text" binding:"required,min=1,max=200"`
}

type CreatePollRequest struct {
	Title                 string             `json:"title" binding:"required,min=3,max=300"`
	Description           string             `json:"description" binding:"max=1000"`
	Options               []CreatePollOption `json:"options" binding:"required,min=2,max=10,dive"`
	AllowMultiple         bool               `json:"allow_multiple"`
	ShowResultsBeforeVote bool               `json:"show_results_before_vote"`
}

type VoteRequest struct {
	OptionIDs []string `json:"option_ids" binding:"required,min=1"`
	VoterID   string   `json:"voter_id" binding:"required,min=8"` // Unique anonymous device/session fingerprint
}

type LivePollUpdate struct {
	Type        string            `json:"type"` // "VOTE_UPDATE", "STATUS_CHANGE", "VIEWER_COUNT"
	PollID      string            `json:"poll_id"`
	TotalVotes  int64             `json:"total_votes"`
	Counts      map[string]int64  `json:"counts"`
	IsClosed    bool              `json:"is_closed"`
	ViewerCount int               `json:"viewer_count,omitempty"`
	Timestamp   time.Time         `json:"timestamp"`
}
