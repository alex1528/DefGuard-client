import { createFileRoute } from '@tanstack/react-router';
import { OidcLoginPage } from '../../../../pages/full/OidcLoginPage/OidcLoginPage';

export const Route = createFileRoute('/full/_default/add/oidc-login')({
  component: OidcLoginPage,
});
