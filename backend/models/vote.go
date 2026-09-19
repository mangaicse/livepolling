package models

import (
	"time"

	"go.mongodb.org/mongo-driver/bson/primitive"
)

type Vote struct {
	ID        primitive.ObjectID `json:"id" bson:"_id,omitempty"`
	PollID    primitive.ObjectID `json:"poll_id" bson:"poll_id"`
	VoterHash string             `json:"voter_hash" bson:"voter_hash"`
	OptionIDs []string           `json:"option_ids" bson:"option_ids"`
	IPHash    string             `json:"-" bson:"ip_hash"`
	CreatedAt time.Time          `json:"created_at" bson:"created_at"`
}
