import React, {Component} from "react";
import {Label, Popup, Table, Icon} from "semantic-ui-react";
import {ADMIN_SECRET, ADMIN_SRV_STR1, MONITOR_SRV} from "../../../shared/env";
import {genUUID} from "../../../shared/tools";
import mqtt from "../../../shared/mqtt";
import {mqtt_sys} from "../../../shared/consts";


class StatNotes extends Component {

    state = {
        gxy1_count: 0,
        gxy2_count: 0,
        gxy3_count: 0,
        gxy4_count: 0,
        gxy5_count: 0,
        gxy6_count: 0,
        gxy7_count: 0,
        gxy8_count: 0,
        str1_count: 0,
        str2_count: 0,
        str3_count: 0,
        str4_count: 0,
        str5_count: 0,
        str6_count: 0,
        str7_count: 0,
        sys: {...mqtt_sys}
    };

    componentDidMount() {
        setInterval(this.getCounts, 10 * 1000);
        mqtt.watch((data, topic) => {
            this.onMqttData(data, topic);
        }, true)
        Object.keys(mqtt_sys).map(t => mqtt.join(t))
    };

    onMqttData = (data, topic) => {
      const {sys} = this.state;
      Object.keys(sys).map(t => {
        if(t === topic) {
          sys[t].value = data;
        }
      })
      this.setState({sys})
    };

    getCounts = () => {
        this.getStr1Count();
        fetch(`${MONITOR_SRV}`)
            .then((response) => {
            if (response.ok) {
                return response.json().then(res => {
                    const s = res.data.result;
                    let state = {};
                    for(let i=0; i<s.length; i++) {
                        let key = s[i].metric.name;
                        let val = parseInt(s[i].value[1], 10);
                        state = {...state, [key+"_count"]: val}
                    }
                    this.setState(state);
                });
            }
        })
    };

    getStr1Count = () => {
        let request = {"janus":"list_sessions","transaction": genUUID(),"admin_secret": ADMIN_SECRET};
        fetch(`${ADMIN_SRV_STR1}`,{
            method: 'POST',
            headers: {'Content-Type': 'application/json'},
            body:  JSON.stringify(request)
        }).then((response) => {
            if (response.ok) {
                return response.json().then(data => {
                    this.setState({str1_count: data.sessions.length});
                });
            }
        });
    };

    render() {
        const {gxy1_count, gxy2_count, gxy3_count, gxy4_count, gxy5_count, gxy6_count, gxy7_count, gxy8_count,
            str1_count, str2_count, str3_count, str4_count, str5_count, str6_count, str7_count, sys} = this.state;

        const i = (<Icon name='heart' size='small' />);

        const sys_info = Object.keys(sys).map(v => {
            return (
              <div><Table.Cell>{sys[v].name} :</Table.Cell>
              <Table.Cell>
                {sys[v].name.match(/^(brecv|bsent)$/) ? (sys[v].value/1000).toFixed(0) + " Kb" : sys[v].value}
              </Table.Cell>
            </div>
            )}
        )

        return (
            <Label attached='top right' size='mini' className='gxy_count' >
                <Table compact='very'>
                    <Table.Header>
                        <Table.Row>
                            <Table.HeaderCell />
                            <Table.HeaderCell />
                            <Table.HeaderCell />
                            <Table.HeaderCell />
                        </Table.Row>
                    </Table.Header>
                    <Table.Body>
                        <Table.Row>
                            <Table.Cell>gxy1 :</Table.Cell>
                            <Table.Cell>{gxy1_count}</Table.Cell>
                            <Table.Cell>gxy5 :</Table.Cell>
                            <Table.Cell>{gxy5_count}</Table.Cell>
                            <Table.Cell>|</Table.Cell>
                            <Table.Cell>str1 :</Table.Cell>
                            <Table.Cell>{str1_count}</Table.Cell>
                            <Table.Cell>str5 :</Table.Cell>
                            <Table.Cell>{str5_count}</Table.Cell>
                        </Table.Row>
                        <Table.Row>
                            <Table.Cell>gxy2 :</Table.Cell>
                            <Table.Cell>{gxy2_count}</Table.Cell>
                            <Table.Cell>gxy6 :</Table.Cell>
                            <Table.Cell>{gxy6_count}</Table.Cell>
                            <Table.Cell>|</Table.Cell>
                            <Table.Cell>str2 :</Table.Cell>
                            <Table.Cell>{str2_count}</Table.Cell>
                            <Table.Cell>str6 :</Table.Cell>
                            <Table.Cell>{str6_count}</Table.Cell>
                        </Table.Row>
                        <Table.Row>
                            <Table.Cell>gxy3 :</Table.Cell>
                            <Table.Cell>{gxy3_count}</Table.Cell>
                            <Table.Cell>gxy7 :</Table.Cell>
                            <Table.Cell>{gxy7_count}</Table.Cell>
                            <Table.Cell>|</Table.Cell>
                            <Table.Cell>str3 :</Table.Cell>
                            <Table.Cell>{str3_count}</Table.Cell>
                            <Table.Cell>str7 :</Table.Cell>
                            <Table.Cell>{str7_count}</Table.Cell>
                        </Table.Row>
                        <Table.Row>
                            <Table.Cell>gxy4 :</Table.Cell>
                            <Table.Cell>{gxy4_count}</Table.Cell>
                            <Table.Cell>gxy8 :</Table.Cell>
                            <Table.Cell>{gxy8_count}</Table.Cell>
                            <Table.Cell>|</Table.Cell>
                            <Table.Cell>str4 :</Table.Cell>
                            <Table.Cell>{str4_count}</Table.Cell>
                            <Table.Cell>{i}{i}</Table.Cell>
                            <Table.Cell>
                              <Popup trigger={i}
                                     position='bottom left'
                                     content={
                                       <Label className='gxy_count' >
                                       <Table compact='very'>
                                         <Table.Body>
                                           <Table.Row>
                                             {sys_info}
                                           </Table.Row>
                                         </Table.Body>
                                       </Table>
                                       </Label>
                                     }
                                     on='click'
                                     hideOnScroll />
                            </Table.Cell>
                        </Table.Row>
                    </Table.Body>
                </Table>
            </Label>
        );
    }
}

export default StatNotes;
