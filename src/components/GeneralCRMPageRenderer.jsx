import {
  ActivityLogPage,
  MeetingsPage,
  FollowUpsPage,
  AccountsPage,
  BusinessDashboard,
  BusinessLeadsPage,
  BusinessReportsPage,
  TeamPage,
  EvaluationsPage,
  WhatsAppPage,
} from "./GeneralCRMPages.jsx";

export default function GeneralCRMPageRenderer({
  page, medicals, setMedicals, demos, setDemos, trials, setTrials,
  followUps, setFollowUps, sales, activities, setActivities, team, setTeam,
  role, currentUser, currentUserId, setPage, searchRequest, onWorkflowChange,
  onConvertTrial, activitiesLoading, onAccountDeleted,
}) {
  switch (page) {
    case "Overview":
      return <BusinessDashboard medicals={medicals} demos={demos} trials={trials} followUps={followUps} sales={sales} setPage={setPage} role={role} currentUser={currentUser} />;
    case "Medicals":
      return <AccountsPage medicals={medicals} setMedicals={setMedicals} role={role} currentUser={currentUser} team={team} searchRequest={searchRequest} onAccountDeleted={onAccountDeleted} />;
    case "Demos":
      return <MeetingsPage demos={demos} setDemos={setDemos} medicals={medicals} role={role} currentUser={currentUser} team={team} onWorkflowChange={onWorkflowChange} />;
    case "Trials":
      return <EvaluationsPage trials={trials} setTrials={setTrials} medicals={medicals} demos={demos} role={role} currentUser={currentUser} onConvertTrial={onConvertTrial} onWorkflowChange={onWorkflowChange} team={team} />;
    case "Follow-ups":
      return <FollowUpsPage followUps={followUps} setFollowUps={setFollowUps} medicals={medicals} role={role} currentUser={currentUser} team={team} />;
    case "Team & Roles":
      return <TeamPage team={team} setTeam={setTeam} role={role} currentUserId={currentUserId} />;
    case "WhatsApp":
      return <WhatsAppPage medicals={medicals} role={role} />;
    case "Leads":
      return <BusinessLeadsPage medicals={medicals} setMedicals={setMedicals} role={role} currentUser={currentUser} setPage={setPage} team={team} />;
    case "Reports":
      return <BusinessReportsPage medicals={medicals} demos={demos} trials={trials} followUps={followUps} sales={sales} role={role} currentUser={currentUser} />;
    case "Activities":
      return <ActivityLogPage activities={activities} setActivities={setActivities} medicals={medicals} role={role} currentUser={currentUser} team={team} loading={activitiesLoading} />;
    default:
      return null;
  }
}
