# User Profile & Professor Classrooms Plan

## Goal
Enable users to view their profile/settings and allow Professors (School role) to manage Classrooms.

## User Review Required
> [!IMPORTANT]
> - "Professor" role currently maps to "School" in the backend logic. The "Classrooms" feature will be added to the School Dashboard (`view-school`).
> - The Profile view will be a new top-level view accessible from the Header.

## Proposed Changes

### Frontend (`index.html`)

#### [NEW] `template#view-profile`
- A new view displaying:
  - User Avatar & Name
  - Email (ReadOnly/Editable)
  - Plan Details
  - System Usage Stats (Simulated or Real)
  - Settings (Theme, etc.)

#### [MODIFY] `template#view-school`
- Add a customized "Salas de Aula" section below the Professors list.
- Display list of Active Classrooms.
- Add "Criar Nova Sala" button.

#### [MODIFY] `template#view-home` (Header)
- Add "Meu Perfil" option in the user dropdown/menu or make the Avatar clickable to navigate to `#profile`.

### Backend Logic (`app_v2.js`)

#### [NEW] `app.loadProfile()`
- Fetch user full data from Firestore.
- Render data into `view-profile`.

#### [MODIFY] `app.loadSchoolDashboard()`
- Fetch and render "Classrooms" (Salas) from Firestore (`classrooms` collection).
- Handle "Create Classroom" action.

#### [NEW] `app.createClassroom()`
- Prompt for Classroom Name.
- Save to Firestore `classrooms` collection linked to the Professor/School UID.

## Verification Plan
### Manual Verification
1. **Profile**:
   - Login as any user.
   - Click "Meu Perfil" in header.
   - Verify all info is correct.
2. **Classrooms**:
   - Login as Professor/School.
   - Go to Dashboard (School View).
   - Click "Criar Nova Sala".
   - Verify it appears in the list.
