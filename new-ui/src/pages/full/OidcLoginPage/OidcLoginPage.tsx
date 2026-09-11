import './style.scss';

import { useNavigate } from '@tanstack/react-router';
import { openUrl } from '@tauri-apps/plugin-opener';
import { useState } from 'react';
import z from 'zod';
import { Button } from '../../../shared/components/Button/Button';
import { ButtonVariant } from '../../../shared/components/Button/types';
import { Controls } from '../../../shared/components/Controls/Controls';
import { FullPageTitle } from '../../../shared/components/FullPageTitle/FullPageTitle';
import { Icon, IconKind } from '../../../shared/components/Icon';
import { SizedBox } from '../../../shared/components/SizedBox/SizedBox';
import { useAppForm } from '../../../shared/form';
import { formChangeLogic } from '../../../shared/formLogic';
import { FullPage } from '../../../shared/layouts/FullPage/FullPage';
import { Snackbar } from '../../../shared/providers/snackbar/snackbar';
import { ThemeSpacing } from '../../../shared/types';

const formSchema = z.object({
  url: z.string().url('Please enter a valid URL'),
});

type FormFields = z.infer<typeof formSchema>;

/**
 * OIDC SSO Login Page.
 *
 * Opens the browser to <instance_url>/self-service-enrollment which is served
 * by Core via nginx route splitting on the same domain as Edge/Proxy.
 *
 * After OIDC authentication, Core generates an enrollment token and redirects
 * to the defguard://addinstance deep-link. The client catches it automatically.
 */
export const OidcLoginPage = () => {
  const navigate = useNavigate();
  const [waiting, setWaiting] = useState(false);

  const form = useAppForm({
    defaultValues: { url: '' } as FormFields,
    validationLogic: formChangeLogic,
    validators: {
      onSubmit: formSchema,
      onChange: formSchema,
    },
    onSubmit: async ({ value }) => {
      try {
        const baseUrl = value.url.replace(/\/+$/, '');
        await openUrl(`${baseUrl}/self-service-enrollment`);
        setWaiting(true);
      } catch {
        Snackbar.error('Failed to open browser. Please check the URL.');
      }
    },
  });

  return (
    <FullPage id="oidc-login-view">
      <FullPageTitle title="Sign in with SSO" />

      {!waiting ? (
        <>
          <p className="page-description">
            Enter your organization's Defguard instance URL to sign in with
            Single Sign-On. After authentication, your VPN configuration will
            be set up automatically.
          </p>

          <form
            onSubmit={(e) => {
              e.stopPropagation();
              e.preventDefault();
              form.handleSubmit();
            }}
          >
            <form.AppForm>
              <form.AppField name="url">
                {(field) => (
                  <field.FormInput
                    label="Instance URL"
                    required
                    placeholder="https://vpn.example.com"
                  />
                )}
              </form.AppField>
              <Controls>
                <Button
                  text="Back"
                  variant={ButtonVariant.Secondary}
                  onClick={() => {
                    navigate({ to: '/full/add' });
                  }}
                />
                <div className="right">
                  <form.Subscribe selector={(s) => s.isSubmitting}>
                    {(isSubmitting) => (
                      <Button
                        text="Sign in with SSO"
                        loading={isSubmitting}
                        variant={ButtonVariant.Primary}
                        iconLeft={IconKind.OpenInNewWindow}
                        onClick={() => {
                          form.handleSubmit();
                        }}
                      />
                    )}
                  </form.Subscribe>
                </div>
              </Controls>
            </form.AppForm>
          </form>
        </>
      ) : (
        <div className="waiting-state">
          <Icon icon={IconKind.Refresh} size={48} />
          <SizedBox height={ThemeSpacing.Xl} />
          <p className="title">Waiting for authentication…</p>
          <SizedBox height={ThemeSpacing.Sm} />
          <p className="description">
            Complete the sign-in process in your browser. Once authenticated,
            your VPN configuration will be added automatically.
          </p>
          <SizedBox height={ThemeSpacing.Xl2} />
          <div className="waiting-actions">
            <Button
              text="Try again"
              variant={ButtonVariant.Secondary}
              onClick={() => setWaiting(false)}
            />
            <Button
              text="Back"
              variant={ButtonVariant.Secondary}
              onClick={() => navigate({ to: '/full/add' })}
            />
          </div>
        </div>
      )}
    </FullPage>
  );
};
