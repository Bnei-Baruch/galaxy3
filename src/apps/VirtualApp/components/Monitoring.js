import React, {
  useEffect,
  useRef,
  useState,
} from 'react';
import {
  Icon,
  Menu,
  Placeholder,
  Popup,
  Table,
} from 'semantic-ui-react';

const usePrevious = (value) => {
  const ref = useRef();
  useEffect(() => {
    ref.current = value;
  });
  return ref.current;
};

export const Monitoring = (props) => {
  const {monitoringData} = props;
	const [data, setData] = useState([]);

  const prevMonitoringData = usePrevious(monitoringData)

  // Show Link Info only when url has ?deb param.
  const url = new URL(window.location.href);
  if (!url.searchParams.has('deb')) {
    return null;
  }

  if (prevMonitoringData !== monitoringData) {
    if (prevMonitoringData) {
      prevMonitoringData.unregister();
    }
    if (monitoringData) {
      monitoringData.register((data) => setData(data));
    }
  }

  const statsTable = (<Table>
    <Table.Body>
      <Table.Row>
        {data.map((oneStat, index) =>
          <Table.Cell key={index}>
            {Object.entries(oneStat).map(([key, value], index) => <div key={index}>{key}: {value}</div>)}
          </Table.Cell>
        )}
      </Table.Row>
    </Table.Body>
  </Table>);

  return (
    <Popup
      trigger={<Menu.Item disabled={!data.length}><Icon name="info" />Link Info</Menu.Item>}
      disabled={!data.length}
      on="click"
      position="bottom right"
      popperDependencies={[!!data.length]}
    >
      <Popup.Content>
        {!data.length ? (
          <Placeholder style={{ minWidth: '200px' }}>
            <Placeholder.Header>
              <Placeholder.Line />
              <Placeholder.Line />
            </Placeholder.Header>
            <Placeholder.Paragraph>
              <Placeholder.Line length='medium' />
              <Placeholder.Line length='short' />
            </Placeholder.Paragraph>
          </Placeholder>
        ) : statsTable}        
      </Popup.Content>
    </Popup>
  );
}
