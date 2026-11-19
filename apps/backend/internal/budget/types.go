package budget

// Month is one month of spending the suggestion starts from, oldest first.
type Month struct {
	Month      string `json:"month" binding:"required,datetime=2006-01"`
	SpentMinor int64  `json:"spentMinor" binding:"min=0"`
}

// Answer is a question Moni asked and what the user answered, in the order asked.
type Answer struct {
	Question string `json:"question" binding:"required,min=1,max=200"`
	Answer   string `json:"answer" binding:"required,min=1,max=200"`
}

// Request mirrors budgetSuggestRequestSchema. Without answers Moni asks its questions; with them it
// suggests a monthly amount. A nil Category asks about the monthly total.
type Request struct {
	Category *string  `json:"category" binding:"omitempty,min=1,max=100"`
	Currency string   `json:"currency" binding:"required,len=3,alpha,uppercase"`
	Months   []Month  `json:"months" binding:"max=6,dive"`
	Answers  []Answer `json:"answers" binding:"max=6,dive"`
	Tone     string   `json:"tone,omitempty" binding:"max=32"`
}

type Question struct {
	Text    string   `json:"text"`
	Choices []string `json:"choices"`
}

// Result encodes the three wire shapes: questions, suggestion and unavailable.
type Result struct {
	Status      string     `json:"status"`         // "ok" | "unavailable"
	Step        string     `json:"step,omitempty"` // "questions" | "suggestion"
	Questions   []Question `json:"questions,omitempty"`
	AmountMinor int64      `json:"amountMinor,omitempty"`
	Note        string     `json:"note,omitempty"`
	ModelID     string     `json:"modelId,omitempty"`
	Reason      string     `json:"reason,omitempty"`
}
