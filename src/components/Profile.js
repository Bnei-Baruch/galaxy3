import React from 'react';
import { useTranslation } from 'react-i18next';
import {
  Dropdown,
} from 'semantic-ui-react';


export const Profile = (props) => {
  const {title = '', client} = props;
  const {t} = useTranslation();

  return (
    <Dropdown inline text={title}>
        <Dropdown.Menu>
            <Dropdown.Item content={t('oldClient.profile')} disabled />
            <Dropdown.Item text={t('oldClient.myAccount')} onClick={() => window.open("https://accounts.kbb1.com/auth/realms/main/account", "_blank")} />
            <Dropdown.Item text={t('oldClient.signOut')} onClick={() => client.signoutRedirect()} />
        </Dropdown.Menu>
    </Dropdown>
  );
}
