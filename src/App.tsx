import React from 'react';
import { ContractProvider, useContractStore } from './store/useContractStore';
import { AppShell } from './components/layout/AppShell';
import { TasksDashboard } from './components/tasks/TasksDashboard';
import { FormWizard } from './components/wizard/FormWizard';
import { DetailView } from './components/detail/DetailView';
import { ErrorBoundary } from './components/common/ErrorBoundary';
const MainViewContent: React.FC = () => {
  const { currentView } = useContractStore();

  switch (currentView) {
    case 'editor':
      return <FormWizard />;
    case 'detail':
      return <DetailView />;
    case 'tasks':
    default:
      return <TasksDashboard />;
  }
};
export const App: React.FC = () => {
  return (
    <ErrorBoundary>
      <ContractProvider>
        <AppShell>
          <MainViewContent />
        </AppShell>
      </ContractProvider>
    </ErrorBoundary>
  );
};

export default App;
