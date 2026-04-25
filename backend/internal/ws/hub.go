package ws

import (
	"encoding/json"
	"log"
	"net/http"
	"sync"

	"github.com/gorilla/websocket"
)

var upgrader = websocket.Upgrader{
	CheckOrigin: func(r *http.Request) bool {
		return true // allow all for POC
	},
}

type Coords struct {
	Lat float64 `json:"lat"`
	Lng float64 `json:"lng"`
}

type EntityState struct {
	DistM    float64 `json:"dist_m"`
	ElapsedS float64 `json:"elapsed_s"`
	Coords   *Coords `json:"coords"`
}

type DeltaState struct {
	Secs  float64 `json:"secs"`
	Label string  `json:"label"`
	Trend string  `json:"trend"`
}

type TickData struct {
	User  EntityState `json:"user"`
	Ghost EntityState `json:"ghost"`
	Delta DeltaState  `json:"delta"`
}

type Message struct {
	Type       string   `json:"type"`
	ShadowMode string   `json:"shadow_mode"`
	Data       TickData `json:"data"`
}

type Hub struct {
	clients map[*websocket.Conn]bool
	mu      sync.Mutex
}

func NewHub() *Hub {
	return &Hub{
		clients: make(map[*websocket.Conn]bool),
	}
}

func (h *Hub) HandleWS(w http.ResponseWriter, r *http.Request) {
	conn, err := upgrader.Upgrade(w, r, nil)
	if err != nil {
		log.Println("Upgrade error:", err)
		return
	}

	h.mu.Lock()
	h.clients[conn] = true
	h.mu.Unlock()

	log.Println("New client connected")

	// Simple read loop to detect disconnects
	go func() {
		defer func() {
			h.mu.Lock()
			delete(h.clients, conn)
			h.mu.Unlock()
			conn.Close()
			log.Println("Client disconnected")
		}()
		for {
			if _, _, err := conn.ReadMessage(); err != nil {
				break
			}
		}
	}()
}

func (h *Hub) Broadcast(msg Message) {
	h.mu.Lock()
	defer h.mu.Unlock()

	data, err := json.Marshal(msg)
	if err != nil {
		log.Println("JSON marshal error:", err)
		return
	}

	for conn := range h.clients {
		err := conn.WriteMessage(websocket.TextMessage, data)
		if err != nil {
			conn.Close()
			delete(h.clients, conn)
		}
	}
}
