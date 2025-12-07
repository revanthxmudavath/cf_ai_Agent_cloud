import { useEffect } from 'react';
  import { useAppStore } from './stores/appStore';
  import { ChatInterface } from './components/ChatInterface';
  import { ConfirmationDialog } from './components/ConfirmationDialog';
import { TaskPanel } from './components/TaskPanel';

  function App() {
    const setUserId = useAppStore((state) => state.setUserId);

  
    useEffect(() => {
      async function initializeUser() {
        try {
         
          const response = await fetch('/api/users/generate-id');
          const data = await response.json();

          console.log('[App] Generated userId:', data.userId);
          setUserId(data.userId);
        } catch (error) {
          console.error('[App] Failed to generate userId:', error);

        
          const fallbackUserId = crypto.randomUUID();
          console.log('[App] Using fallback userId:', fallbackUserId);
          setUserId(fallbackUserId);
        }
      }

      initializeUser();
    }, [setUserId]);

    return (
      <>
        <TaskPanel />
        <ChatInterface />
        <ConfirmationDialog />
      </>
    );
  }

  export default App;