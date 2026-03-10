# EduAI Grouping + Chat + @AI MVP

## 1) Product scope

This MVP adds a project collaboration workflow on top of current Virtual Teacher features.

Primary user goals:
- Teacher creates a project and starts grouping.
- Students are automatically assigned into groups.
- Students without active grouping can be pulled into available groups.
- Each group has a chat room with message history.
- Students can mention `@ai` in group chat for assistant replies.
- Group members can see each student's last online time.

## 2) User stories

Teacher:
- As a teacher, I can create a project with target group size.
- As a teacher, I can run auto-grouping for eligible students.
- As a teacher, I can view groups and members for a project.
- As a teacher, I can manually move ungrouped students into groups.

Student:
- As a student, I can enter my assigned group chat.
- As a student, I can send and read messages.
- As a student, I can mention `@ai` and receive an AI response in chat.
- As a student, I can see who is online and each member's last active time.

## 3) MVP non-goals

- No advanced recommendation algorithm by profile similarity.
- No grading automation.
- No file attachments in chat for MVP v1.
- No push notifications (in-app polling/realtime only).

## 4) Functional requirements

1. Project management
- Create project: course, name, description, target group size, max groups (optional).
- Project status: draft, grouping, active, archived.

2. Grouping
- Auto-grouping only includes students not already in an active group for the same project.
- Existing groups are filled first if capacity remains.
- Remaining students are distributed into new groups.
- Teacher can manually assign ungrouped students.

3. Group chat
- One chat room per group.
- Message list is ordered by created_at ascending.
- Message supports type: user, ai.

4. AI mention
- If message contains `@ai`, backend invokes AI responder.
- AI response is posted to same group as a system/ai message.
- AI should use course context and latest conversation window.

5. Presence
- Client sends heartbeat to update last_seen_at.
- Group member list shows online if active in last 2 minutes.
- Otherwise show relative last online time.

## 5) API list (v1)

- `POST /api/projects`
- `GET /api/projects?courseId=<id>`
- `POST /api/projects/[projectId]/groups/auto`
- `GET /api/projects/[projectId]/groups`
- `POST /api/projects/[projectId]/groups/assign`
- `GET /api/groups/[groupId]/messages?limit=50&before=<iso>`
- `POST /api/groups/[groupId]/messages`
- `POST /api/groups/[groupId]/presence`
- `GET /api/groups/[groupId]/members`

## 6) Suggested build order

1. Database schema migration.
2. Project CRUD + auto-group API.
3. Group chat read/send API.
4. Presence API and member status API.
5. `@ai` integration in message API.

## 7) Acceptance criteria

- Teacher can create a project and run auto-grouping successfully.
- Ungrouped students are assignable into available groups.
- Group chat persists message history and returns latest messages.
- `@ai` mention generates a reply in the same chat thread.
- Last online values update when students are active.
