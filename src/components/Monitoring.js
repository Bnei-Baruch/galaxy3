import React, {
  useEffect,
  useRef,
  useState,
} from 'react';
import {
  Icon,
  Menu,
	Modal,
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
        {data.map(({name, reports, timestamp}) => (
          <Table.Row key={name}>
            <Table.Cell key={name} style={{'overflow': 'hidden', 'textOverflow': 'ellipsis', 'maxWidth': '8em'}}>
              {name} - {timestamp}
            </Table.Cell>
            {
              reports.map((report, index) =>
                <Table.Cell key={index} style={{'overflow': 'hidden', 'textOverflow': 'ellipsis', 'maxWidth': '8em'}}>
                  <div style={{'maxHeight': '20em'}}>
                    {Object.entries(report).map(([key, value], index) =>
                      <div key={index}>{key}: {(value !== undefined && value !== null && value.toString()) || 'undefined or null'}</div>
                    )}
                  </div>
                </Table.Cell>
              )
            }
          </Table.Row>
        ))}
    </Table.Body>
  </Table>);

  return (
		<Modal trigger={<Menu.Item disabled={!Object.keys(data).length}><Icon name="info" />Link Info</Menu.Item>}
					 disabled={!Object.keys(data).length}>
			<Modal.Header>Link Info</Modal.Header>
			<Modal.Content>
					{statsTable}        
      </Modal.Content>
    </Modal> 
  );
}
