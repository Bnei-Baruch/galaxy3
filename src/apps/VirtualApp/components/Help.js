import React from 'react';
import { Button, Icon, Menu, Popup } from 'semantic-ui-react';

export const Help = () => (
  <Popup
    trigger={<Menu.Item><Icon name="address card" />Feedback/Help</Menu.Item>}
    on="click"
    position="bottom right"
  >
    <Popup.Content>
      <Menu vertical>
        <Menu.Item>
          <Button attached="top">Feedback</Button>
          <Button basic fluid as="a" href='https://forms.gle/F6Lm2KMLUkU4hrmK8' target="_blank" rel="noopener noreferrer">Feedback</Button>
        </Menu.Item>
      </Menu>
      <Menu vertical>
        <Menu.Item>
          <Button attached='top'>Help</Button>
          <Button basic fluid as="a" href='https://bit.ly/2JkBU08' target="_blank" rel="noopener noreferrer">English</Button>
          <Button basic fluid as="a" href='https://bit.ly/39miYbJ' target="_blank" rel="noopener noreferrer">Spanish</Button>
          <Button basic fluid as="a" href='https://bit.ly/3amR5BV' target="_blank" rel="noopener noreferrer">Hebrew</Button>
          <Button basic fluid as="a" href='https://bit.ly/2UE1l1Y' target="_blank" rel="noopener noreferrer">Russian</Button>
        </Menu.Item>
      </Menu>
    </Popup.Content>
  </Popup>
);
