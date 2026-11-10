package analytics

import (
	"encoding/json"
	"errors"
	"fmt"
	"log"
	"net/http"
	"regexp"
	"sort"
	"time"

	"cloud.google.com/go/firestore"
	"example.com/thaiteacher/platform/authn"
	"example.com/thaiteacher/platform/config"
	"google.golang.org/api/iterator"
	monitoringapi "google.golang.org/api/monitoring/v3"
	"google.golang.org/api/option"
	"google.golang.org/grpc/codes"
	"google.golang.org/grpc/status"
)

var sessionIDPattern = regexp.MustCompile(`^[0-9a-fA-F-]{36}$`)

type Handler struct {
	store    *firestore.Client
	verifier authn.Verifier
	cfg      config.Config
}

func NewHandler(store *firestore.Client, verifier authn.Verifier, cfg config.Config) *Handler {
	return &Handler{store: store, verifier: verifier, cfg: cfg}
}
func (h *Handler) VisitHandler() http.Handler {
	return authn.Authenticate(h.verifier, http.HandlerFunc(h.visit))
}
func (h *Handler) DashboardHandler() http.Handler {
	return authn.Authenticate(h.verifier, http.HandlerFunc(h.dashboard))
}

func (h *Handler) visit(w http.ResponseWriter, r *http.Request) {
	claims := authn.FromContext(r.Context())
	if claims.Role == "supperAdmin" {
		w.WriteHeader(http.StatusNoContent)
		return
	}
	var input struct {
		SessionID string `json:"sessionId"`
	}
	decoder := json.NewDecoder(http.MaxBytesReader(w, r.Body, 1024))
	decoder.DisallowUnknownFields()
	if err := decoder.Decode(&input); err != nil || !sessionIDPattern.MatchString(input.SessionID) {
		respondError(w, 400, "invalid_session_id")
		return
	}
	id := claims.Subject + "_" + input.SessionID
	_, err := h.store.Collection("usageSessions").Doc(id).Create(r.Context(), map[string]any{"uid": claims.Subject, "startedAt": time.Now().UTC()})
	if status.Code(err) == codes.AlreadyExists {
		w.WriteHeader(http.StatusNoContent)
		return
	}
	if err != nil {
		log.Printf("record user visit: %v", err)
		respondError(w, 502, "visit_save_failed")
		return
	}
	w.WriteHeader(http.StatusCreated)
}

type DailyUsage struct {
	Date        string `json:"date"`
	Sessions    int    `json:"sessions"`
	ActiveUsers int    `json:"activeUsers"`
}
type FrequentUser struct {
	UID       string    `json:"uid"`
	Sessions  int       `json:"sessions"`
	Day       int       `json:"day"`
	Week      int       `json:"week"`
	Month     int       `json:"month"`
	LastVisit time.Time `json:"lastVisit"`
}
type QuotaMetric struct {
	Used           int64   `json:"used"`
	FreeDailyLimit int64   `json:"freeDailyLimit"`
	Percent        float64 `json:"percent"`
}
type FirestoreUsage struct {
	Available   bool        `json:"available"`
	Error       string      `json:"error,omitempty"`
	PeriodStart time.Time   `json:"periodStart"`
	AsOf        time.Time   `json:"asOf"`
	Reads       QuotaMetric `json:"reads"`
	Writes      QuotaMetric `json:"writes"`
	Deletes     QuotaMetric `json:"deletes"`
}
type Dashboard struct {
	WindowStart    time.Time      `json:"windowStart"`
	Sessions30d    int            `json:"sessions30d"`
	ActiveUsers7d  int            `json:"activeUsers7d"`
	ActiveUsers30d int            `json:"activeUsers30d"`
	Daily          []DailyUsage   `json:"daily"`
	FrequentUsers  []FrequentUser `json:"frequentUsers"`
	Firestore      FirestoreUsage `json:"firestore"`
}

func (h *Handler) dashboard(w http.ResponseWriter, r *http.Request) {
	if authn.FromContext(r.Context()).Role != "supperAdmin" {
		respondError(w, 403, "forbidden")
		return
	}
	now := time.Now().UTC()
	loc, err := time.LoadLocation("Asia/Bangkok")
	if err != nil {
		loc = time.FixedZone("ICT", 7*60*60)
	}
	localNow := now.In(loc)
	todayStart := time.Date(localNow.Year(), localNow.Month(), localNow.Day(), 0, 0, 0, 0, loc)
	weekStart := todayStart.AddDate(0, 0, -6)
	start := todayStart.AddDate(0, 0, -29)
	today := localNow.Format("2006-01-02")
	iter := h.store.Collection("usageSessions").Where("startedAt", ">=", start).OrderBy("startedAt", firestore.Asc).Documents(r.Context())
	defer iter.Stop()
	daily := map[string]*DailyUsage{}
	uniqueByDay := map[string]map[string]bool{}
	unique7 := map[string]bool{}
	unique30 := map[string]bool{}
	frequent := map[string]*FrequentUser{}
	result := Dashboard{WindowStart: start, Daily: []DailyUsage{}, FrequentUsers: []FrequentUser{}}
	for {
		doc, err := iter.Next()
		if errors.Is(err, iterator.Done) {
			break
		}
		if err != nil {
			log.Printf("read usage sessions: %v", err)
			respondError(w, 502, "activity_unavailable")
			return
		}
		var visit struct {
			UID       string    `firestore:"uid"`
			StartedAt time.Time `firestore:"startedAt"`
		}
		if err := doc.DataTo(&visit); err != nil || visit.UID == "" {
			continue
		}
		day := visit.StartedAt.In(loc).Format("2006-01-02")
		if daily[day] == nil {
			daily[day] = &DailyUsage{Date: day}
			uniqueByDay[day] = map[string]bool{}
		}
		daily[day].Sessions++
		uniqueByDay[day][visit.UID] = true
		unique30[visit.UID] = true
		if visit.StartedAt.After(now.AddDate(0, 0, -7)) {
			unique7[visit.UID] = true
		}
		if frequent[visit.UID] == nil {
			frequent[visit.UID] = &FrequentUser{UID: visit.UID}
		}
		frequent[visit.UID].Sessions++
		frequent[visit.UID].Month++
		if day == today { frequent[visit.UID].Day++ }
		if !visit.StartedAt.Before(weekStart) { frequent[visit.UID].Week++ }
		if visit.StartedAt.After(frequent[visit.UID].LastVisit) {
			frequent[visit.UID].LastVisit = visit.StartedAt
		}
		result.Sessions30d++
	}
	result.ActiveUsers7d = len(unique7)
	result.ActiveUsers30d = len(unique30)
	for day, entry := range daily {
		entry.ActiveUsers = len(uniqueByDay[day])
		result.Daily = append(result.Daily, *entry)
	}
	sort.Slice(result.Daily, func(i, j int) bool { return result.Daily[i].Date < result.Daily[j].Date })
	for _, user := range frequent {
		result.FrequentUsers = append(result.FrequentUsers, *user)
	}
	sort.Slice(result.FrequentUsers, func(i, j int) bool { return result.FrequentUsers[i].Sessions > result.FrequentUsers[j].Sessions })
	result.Firestore = h.firestoreUsage(r, now)
	respond(w, 200, result)
}

func (h *Handler) firestoreUsage(r *http.Request, now time.Time) FirestoreUsage {
	loc, err := time.LoadLocation("America/Los_Angeles")
	if err != nil {
		loc = time.FixedZone("Pacific", -8*60*60)
	}
	localNow := now.In(loc)
	start := time.Date(localNow.Year(), localNow.Month(), localNow.Day(), 0, 0, 0, 0, loc)
	result := FirestoreUsage{PeriodStart: start, AsOf: now, Reads: QuotaMetric{FreeDailyLimit: 50000}, Writes: QuotaMetric{FreeDailyLimit: 20000}, Deletes: QuotaMetric{FreeDailyLimit: 20000}}
	options := []option.ClientOption{option.WithScopes("https://www.googleapis.com/auth/monitoring.read")}
	if h.cfg.CredentialsJSON != "" {
		options = append(options, option.WithCredentialsJSON([]byte(h.cfg.CredentialsJSON)))
	} else if h.cfg.CredentialsFile != "" {
		options = append(options, option.WithCredentialsFile(h.cfg.CredentialsFile))
	}
	service, err := monitoringapi.NewService(r.Context(), options...)
	if err != nil {
		log.Printf("create monitoring client: %v", err)
		result.Error = "monitoring_unavailable"
		return result
	}
	metrics := []struct {
		name   string
		target *QuotaMetric
	}{{"read_ops_count", &result.Reads}, {"write_ops_count", &result.Writes}, {"delete_ops_count", &result.Deletes}}
	for _, metric := range metrics {
		used, err := readMetric(r, service, h.cfg.FirebaseProjectID, metric.name, start, now)
		if err != nil {
			log.Printf("read monitoring metric %s: %v", metric.name, err)
			result.Error = "monitoring_unavailable"
			return result
		}
		metric.target.Used = used
		metric.target.Percent = float64(used) * 100 / float64(metric.target.FreeDailyLimit)
	}
	result.Available = true
	return result
}

func readMetric(r *http.Request, service *monitoringapi.Service, project, metric string, start, end time.Time) (int64, error) {
	var sum int64
	page := ""
	for {
		call := service.Projects.TimeSeries.List("projects/" + project).
			Filter(fmt.Sprintf(`metric.type="firestore.googleapis.com/document/%s"`, metric)).
			IntervalStartTime(start.Format(time.RFC3339)).IntervalEndTime(end.Format(time.RFC3339)).View("FULL").PageSize(1000)
		if page != "" {
			call = call.PageToken(page)
		}
		response, err := call.Context(r.Context()).Do()
		if err != nil {
			return 0, err
		}
		for _, series := range response.TimeSeries {
			for _, point := range series.Points {
				if point.Value != nil && point.Value.Int64Value != nil {
					sum += *point.Value.Int64Value
				}
			}
		}
		page = response.NextPageToken
		if page == "" {
			break
		}
	}
	return sum, nil
}

func respond(w http.ResponseWriter, code int, value any) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(code)
	_ = json.NewEncoder(w).Encode(value)
}
func respondError(w http.ResponseWriter, code int, message string) {
	respond(w, code, map[string]string{"error": message})
}
