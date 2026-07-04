import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import {AuthProvider} from './contexts/AuthContext';
import AppRouter from './router';
import './index.css';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <AuthProvider>
      <AppRouter />
    </AuthProvider>
  </StrictMode>,
);
