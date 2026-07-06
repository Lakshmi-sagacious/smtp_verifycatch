import { createBrowserRouter, Navigate } from 'react-router-dom';
import { LoginPage } from './pages/Login';
import { SignupPage } from './pages/Signup';
import { DashboardPage } from './pages/Dashboard';
import { InboxesPage } from './pages/Inboxes';
import { InboxDetailPage } from './pages/InboxDetail';
import { MessageViewPage } from './pages/MessageView';
import { DomainsPage } from './pages/Domains';
import { DomainDetailPage } from './pages/DomainDetail';
import { ApiKeysPage } from './pages/ApiKeys';
import { SmtpCredentialsPage } from './pages/SmtpCredentials';
import { WebhooksPage } from './pages/Webhooks';
import { LogsPage } from './pages/Logs';
import { LogDetailPage } from './pages/LogDetail';
import { RequireAuth } from './lib/RequireAuth';
import { Shell } from './Shell';

export const router = createBrowserRouter([
  { path: '/login', element: <LoginPage /> },
  { path: '/signup', element: <SignupPage /> },
  {
    path: '/',
    element: <RequireAuth />,
    children: [
      {
        element: <Shell />,
        children: [
          { index: true, element: <Navigate to="/dashboard" replace /> },
          { path: 'dashboard', element: <DashboardPage /> },
          { path: 'inboxes', element: <InboxesPage /> },
          { path: 'inboxes/:inboxId', element: <InboxDetailPage /> },
          { path: 'inboxes/:inboxId/messages/:messageId', element: <MessageViewPage /> },
          { path: 'domains', element: <DomainsPage /> },
          { path: 'domains/:id', element: <DomainDetailPage /> },
          { path: 'api-keys', element: <ApiKeysPage /> },
          { path: 'smtp-credentials', element: <SmtpCredentialsPage /> },
          { path: 'webhooks', element: <WebhooksPage /> },
          { path: 'logs', element: <LogsPage /> },
          { path: 'logs/:id', element: <LogDetailPage /> },
        ],
      },
    ],
  },
  { path: '*', element: <Navigate to="/" replace /> },
]);
