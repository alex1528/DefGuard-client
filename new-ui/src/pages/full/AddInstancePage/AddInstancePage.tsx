import './style.scss';

import { useLoaderData, useNavigate, useSearch } from '@tanstack/react-router';
import { error } from '@tauri-apps/plugin-log';
import { Fragment, useEffect, useMemo, useRef, useState } from 'react';
import z from 'zod';
import { Button } from '../../../shared/components/Button/Button';
import { ButtonVariant } from '../../../shared/components/Button/types';
import { Controls } from '../../../shared/components/Controls/Controls';
import { FullPageTitle } from '../../../shared/components/FullPageTitle/FullPageTitle';
import { SizedBox } from '../../../shared/components/SizedBox/SizedBox';
import { useAppForm } from '../../../shared/form';
import { formChangeLogic } from '../../../shared/formLogic';
import { FullPage } from '../../../shared/layouts/FullPage/FullPage';
import { Snackbar } from '../../../shared/providers/snackbar/snackbar';
import {
  enrollmentAddInstance,
  enrollmentAutoActivateAndFinish,
  enrollmentCreateDevice,
} from '../../../shared/rust-api/enrollment';
import { ThemeSpacing } from '../../../shared/types';
import { isPresent } from '../../../shared/utils/isPresent';
import { useEnrollmentStore } from '../EnrollmentPage/hooks/useEnrollmentStore';

const formSchema = z.object({
  token: z.string().min(1, 'Required'),
  url: z.string().min(1, 'Required'),
  name: z.string().min(1, 'Required'),
});

type FormFields = z.infer<typeof formSchema>;

export const AddInstancePage = () => {
  const navigate = useNavigate();
  const { deviceName } = useLoaderData({ from: '/full/_default/add/instance' });
  const searchValues = useSearch({ from: '/full/_default/add/instance' });
  const autoSubmitFired = useRef(false);
  const [autoSubmitting, setAutoSubmitting] = useState(false);

  const hasInitialValues = isPresent(searchValues.token) && isPresent(searchValues.url);

  const defaultValues = useMemo((): FormFields => {
    return {
      token: searchValues.token ?? '',
      url: searchValues.url ?? '',
      name: deviceName,
    };
  }, [searchValues, deviceName]);

  const form = useAppForm({
    defaultValues,
    validationLogic: formChangeLogic,
    validators: {
      onSubmit: formSchema,
      onChange: formSchema,
    },
    onSubmit: async ({ value, formApi }) => {
      const result = await enrollmentAddInstance(value);
      if (result.error ?? result.errorKind) {
        if (result.errorKind === 'network') {
          formApi.setErrorMap({
            onSubmit: { fields: { url: 'Invalid URL.' } },
          });
          setAutoSubmitting(false);
          return;
        }
        if (result.errorKind === 'unauthorized') {
          formApi.setErrorMap({
            onSubmit: { fields: { token: 'Invalid token.' } },
          });
          setAutoSubmitting(false);
          return;
        }
        if (result.error?.toLowerCase().includes('device name')) {
          formApi.setErrorMap({
            onSubmit: { fields: { name: 'Name already used.' } },
          });
          setAutoSubmitting(false);
          return;
        }
        void error(`Failed to add instance: ${result.error ?? 'unknown error'}`);
        Snackbar.error('Communication error, contact administrator.');
        setAutoSubmitting(false);
        return;
      }
      if (result.session_id) {
        await enrollmentCreateDevice(result.session_id, value.name.trim());
      }
      if (
        result.startResponse &&
        !result.startResponse.user.enrolled &&
        result.session_id
      ) {
        // Externally-managed (OIDC) users have no local password to set. When
        // the instance also does not require MFA, the enrollment wizard would
        // only present two no-op clicks (Welcome -> Finish). Auto-activate and
        // finish the session, then go straight to the overview. The device and
        // its VPN configuration were already created by enrollmentCreateDevice
        // above, so the connection can be started/stopped from the overview.
        const { user, settings } = result.startResponse;
        if (user.password_management_disabled && !settings.mfa_required) {
          const autoResult = await enrollmentAutoActivateAndFinish(result.session_id);
          if (autoResult.error) {
            void error(`Auto enrollment failed: ${autoResult.error}`);
            Snackbar.error('Communication error, contact administrator.');
            return;
          }
          navigate({ to: '/full/overview', replace: true });
          return;
        }
        useEnrollmentStore
          .getState()
          .start(result.startResponse, result.session_id, undefined);
        navigate({
          to: '/full/enrollment',
          replace: true,
        });
      } else {
        navigate({
          to: '/full/overview',
          replace: true,
        });
      }
    },
  });

  // Auto-submit when deep-link provides token + url (zero-interaction enrollment).
  // The device name defaults to the machine hostname (from the route loader).
  // Guarded by a ref to ensure we only fire once even if the effect re-runs.
  useEffect(() => {
    if (hasInitialValues && !autoSubmitFired.current) {
      autoSubmitFired.current = true;
      setAutoSubmitting(true);
      form.handleSubmit();
    }
  }, [hasInitialValues, form]);

  // While auto-submitting via deep-link, show a minimal loading state
  // instead of the full form — the user should not need to interact at all.
  if (autoSubmitting && hasInitialValues) {
    return (
      <FullPage id="add-instance-view">
        <FullPageTitle title="Configuring VPN…" />
        <p className="page-description">
          Setting up your connection automatically. This may take a moment.
        </p>
      </FullPage>
    );
  }

  return (
    <FullPage id="add-instance-view">
      <FullPageTitle title="Add instance" />
      <p className="page-description">{`To add an instance, provide the instance URL along with a valid provisioning token. These credentials are issued by your administrator and are required to initiate the setup.`}</p>
      <form
        onSubmit={(e) => {
          e.stopPropagation();
          e.preventDefault();
          form.handleSubmit();
        }}
      >
        <form.AppForm>
          {!hasInitialValues && (
            <Fragment>
              <form.AppField name="url">
                {(field) => <field.FormInput label="URL" required />}
              </form.AppField>
              <SizedBox height={ThemeSpacing.Xl} />
              <form.AppField name="token">
                {(field) => <field.FormInput label="Token" required />}
              </form.AppField>
              <SizedBox height={ThemeSpacing.Xl} />
            </Fragment>
          )}
          <form.AppField name="name">
            {(field) => <field.FormInput required label="Device name" />}
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
                    text="Add Instance"
                    loading={isSubmitting}
                    variant={ButtonVariant.Primary}
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
    </FullPage>
  );
};
