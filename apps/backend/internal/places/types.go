// Package places proxies Google Places API (New) Autocomplete and Place Details
// so the Places key stays on the server.
package places

type Status string

const (
	StatusOK          Status = "ok"
	StatusNotFound    Status = "not_found"
	StatusUnavailable Status = "unavailable"
)

type LatLng struct {
	Latitude  float64 `json:"latitude" binding:"min=-90,max=90"`
	Longitude float64 `json:"longitude" binding:"min=-180,max=180"`
}

type AutocompleteRequest struct {
	Input        string  `json:"input" binding:"required"`
	SessionToken string  `json:"sessionToken" binding:"max=64"`
	Bias         *LatLng `json:"bias"`
}

type Prediction struct {
	PlaceID        string  `json:"placeId"`
	PrimaryText    string  `json:"primaryText"`
	SecondaryText  *string `json:"secondaryText"`
	DistanceMeters *int    `json:"distanceMeters"`
}

type AutocompleteResult struct {
	Status      Status       `json:"status"`
	Predictions []Prediction `json:"predictions,omitzero"`
}

type DetailsRequest struct {
	PlaceID      string `json:"placeId" binding:"required,max=300"`
	SessionToken string `json:"sessionToken" binding:"max=64"`
}

type Place struct {
	PlaceID   string  `json:"placeId"`
	Latitude  float64 `json:"latitude"`
	Longitude float64 `json:"longitude"`
	Address   *string `json:"address"`
}

type DetailsResult struct {
	Status Status `json:"status"`
	Place  *Place `json:"place,omitempty"`
}
