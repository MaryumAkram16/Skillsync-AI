# Security Specification: SkillSync AI Firestore

## Data Invariants
- `userId` must always match `request.auth.uid`.
- `timestamp` must be `request.time` (server timestamp).
- `feature` must be one of the pre-defined options.
- `rating` must be an integer between 1 and 5.
- `action` must be "started" or "completed".
- `type` must be one of the pre-defined activity types.
- Users can only read/write their own records.
- Records are immutable once created (or at least critical fields are).

## Dirty Dozen Payloads
1. **Identity Spoofing**: Attempt to create feedback for another user.
   - `userId`: "other_user_id"
   - Expected: REJECTED
2. **Value Poisoning (Rating)**: Attempt to submit a rating of 10.
   - `rating`: 10
   - Expected: REJECTED
3. **Value Poisoning (Feature)**: Attempt to submit feedback for a non-existent feature.
   - `feature`: "hacking-mode"
   - Expected: REJECTED
4. **State Shortcutting**: Attempt to log "completed" usage with negative `timeSpent`.
   - `timeSpent`: -100
   - Expected: REJECTED
5. **Temporal Integrity**: Attempt to submit a future timestamp.
   - `timestamp`: 2099-01-01T00:00:00Z
   - Expected: REJECTED (must be server timestamp)
6. **Resource Poisoning**: Attempt to submit a massive comment to bloat storage.
   - `comment`: "A" * 1000000
   - Expected: REJECTED (limit to 2048 chars)
7. **Identity Spoofing (Usage)**: Attempt to log usage for another user.
   - `userId`: "target_user"
   - Expected: REJECTED
8. **Value Poisoning (Action)**: Attempt to submit invalid action.
   - `action`: "cheating"
   - Expected: REJECTED
9. **Identity Spoofing (Activity)**: Attempt to log activity for another user.
   - `userId`: "admin_uid"
   - Expected: REJECTED
10. **Resource Poisoning (Details)**: Massive details string in log.
    - `details`: "X" * 1000000
    - Expected: REJECTED (limit to 4096 chars)
11. **Path Variable Hardening**: Attempt to write to `/users/other_user`.
    - Path: `/users/victim_uid`
    - Expected: REJECTED
12. **Blanket Read**: Attempt to query all feedback.
    - Query: `db.collection("userFeedback").get()`
    - Expected: REJECTED (must have `userId` filter)

## Test Runner (Simplified)
```javascript
// Test User: { uid: "user_123" }

// 1. Create own feedback
db.collection("userFeedback").add({
  userId: "user_123",
  feature: "skill-assessment",
  rating: 5,
  comment: "Great!",
  timestamp: firebase.firestore.FieldValue.serverTimestamp()
}); // SUCCESS

// 2. Create other's feedback
db.collection("userFeedback").add({
  userId: "user_456",
  feature: "skill-assessment",
  rating: 1,
  comment: "Bad",
  timestamp: firebase.firestore.FieldValue.serverTimestamp()
}); // FAILURE

// 3. Read own feedback
db.collection("userFeedback").where("userId", "==", "user_123").get(); // SUCCESS

// 4. Read all feedback
db.collection("userFeedback").get(); // FAILURE
```