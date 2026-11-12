package places

import (
	"bytes"
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"net/http"
	"net/url"
	"time"
)

const (
	DefaultBaseURL   = "https://places.googleapis.com/v1"
	maxPredictions   = 5
	biasRadiusMeters = 5000
	// Only Essentials fields: displayName or anything Pro would bill the Details call at a higher SKU.
	detailsFieldMask = "id,location,formattedAddress"
)

var errNotFound = errors.New("place not found")

type Client struct {
	apiKey  string
	baseURL string
	http    *http.Client
}

func NewClient(apiKey, baseURL string) *Client {
	return &Client{apiKey: apiKey, baseURL: baseURL, http: &http.Client{Timeout: 4 * time.Second}}
}

type googleText struct {
	Text string `json:"text"`
}

type autocompleteBody struct {
	Input               string        `json:"input"`
	SessionToken        string        `json:"sessionToken,omitempty"`
	IncludedRegionCodes []string      `json:"includedRegionCodes"`
	LanguageCode        string        `json:"languageCode"`
	LocationBias        *locationBias `json:"locationBias,omitempty"`
	Origin              *LatLng       `json:"origin,omitempty"`
}

type locationBias struct {
	Circle circle `json:"circle"`
}

type circle struct {
	Center LatLng  `json:"center"`
	Radius float64 `json:"radius"`
}

type autocompleteResponse struct {
	Suggestions []struct {
		PlacePrediction *struct {
			PlaceID          string `json:"placeId"`
			StructuredFormat struct {
				MainText      googleText  `json:"mainText"`
				SecondaryText *googleText `json:"secondaryText"`
			} `json:"structuredFormat"`
			DistanceMeters *int `json:"distanceMeters"`
		} `json:"placePrediction"`
	} `json:"suggestions"`
}

type detailsResponse struct {
	ID               string  `json:"id"`
	Location         *LatLng `json:"location"`
	FormattedAddress string  `json:"formattedAddress"`
}

func (c *Client) Autocomplete(ctx context.Context, req AutocompleteRequest) ([]Prediction, error) {
	body := autocompleteBody{
		Input:               req.Input,
		SessionToken:        req.SessionToken,
		IncludedRegionCodes: []string{"my"},
		LanguageCode:        "en",
	}
	if req.Bias != nil {
		body.LocationBias = &locationBias{Circle: circle{Center: *req.Bias, Radius: biasRadiusMeters}}
		body.Origin = req.Bias
	}
	payload, err := json.Marshal(body)
	if err != nil {
		return nil, err
	}
	httpReq, err := http.NewRequestWithContext(ctx, http.MethodPost, c.baseURL+"/places:autocomplete", bytes.NewReader(payload))
	if err != nil {
		return nil, err
	}
	httpReq.Header.Set("Content-Type", "application/json")

	var res autocompleteResponse
	if err := c.do(httpReq, &res); err != nil {
		return nil, err
	}
	predictions := []Prediction{}
	for _, s := range res.Suggestions {
		p := s.PlacePrediction
		if p == nil || p.PlaceID == "" {
			continue
		}
		prediction := Prediction{PlaceID: p.PlaceID, PrimaryText: p.StructuredFormat.MainText.Text, DistanceMeters: p.DistanceMeters}
		if st := p.StructuredFormat.SecondaryText; st != nil && st.Text != "" {
			prediction.SecondaryText = &st.Text
		}
		predictions = append(predictions, prediction)
		if len(predictions) == maxPredictions {
			break
		}
	}
	return predictions, nil
}

func (c *Client) Details(ctx context.Context, placeID, sessionToken string) (Place, error) {
	endpoint := c.baseURL + "/places/" + url.PathEscape(placeID)
	if sessionToken != "" {
		endpoint += "?" + url.Values{"sessionToken": {sessionToken}}.Encode()
	}
	httpReq, err := http.NewRequestWithContext(ctx, http.MethodGet, endpoint, nil)
	if err != nil {
		return Place{}, err
	}
	httpReq.Header.Set("X-Goog-FieldMask", detailsFieldMask)

	var res detailsResponse
	if err := c.do(httpReq, &res); err != nil {
		return Place{}, err
	}
	if res.Location == nil {
		return Place{}, fmt.Errorf("place %q has no location", placeID)
	}
	place := Place{PlaceID: res.ID, Latitude: res.Location.Latitude, Longitude: res.Location.Longitude}
	if place.PlaceID == "" {
		place.PlaceID = placeID
	}
	if res.FormattedAddress != "" {
		place.Address = &res.FormattedAddress
	}
	return place, nil
}

// do sends req with the API key and decodes a 200 body into out. A malformed or unknown place ID
// comes back as 400 INVALID_ARGUMENT or 404 NOT_FOUND, both reported as errNotFound.
func (c *Client) do(req *http.Request, out any) error {
	req.Header.Set("X-Goog-Api-Key", c.apiKey)
	res, err := c.http.Do(req)
	if err != nil {
		return err
	}
	defer res.Body.Close()
	switch {
	case res.StatusCode == http.StatusOK:
		return json.NewDecoder(res.Body).Decode(out)
	case res.StatusCode == http.StatusNotFound || res.StatusCode == http.StatusBadRequest:
		return fmt.Errorf("%w: google %d", errNotFound, res.StatusCode)
	default:
		msg, _ := io.ReadAll(io.LimitReader(res.Body, 512))
		return fmt.Errorf("google %d: %s", res.StatusCode, msg)
	}
}
