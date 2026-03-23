import React, {Component} from "react";
import {Label, Table} from "semantic-ui-react";
import {ADMIN_SECRET, ADMIN_SRV_STR1, MONITOR_SRV} from "../../../shared/env";
import {genUUID} from "../../../shared/tools";

class StatNotes extends Component {
  state = {};

  componentDidMount() {
    let state = {gxy_sum: 0, str_sum: 0};
    for (let i = 1; i < 13; i++) {
      state["gxy" + i + "_count"] = 0;
      state["str" + i + "_count"] = 0;
    }
    this.setState({...state});
    setInterval(this.getCounts, 10 * 1000);
  }

  getCounts = () => {
    this.getStr1Count();
    fetch(`${MONITOR_SRV}`).then((response) => {
      if (response.ok) {
        return response.json().then((res) => {
          const s = res.data.result;
          let state = {gxy_sum: 0, str_sum: 0};
          for (let i = 0; i < s.length; i++) {
            let key = s[i].metric.name;
            let val = parseInt(s[i].value[1], 10);
            let skey = key.slice(0, 3);
            state[skey + "_sum"] = state[skey + "_sum"] + val;
            state = {...state, [key + "_count"]: val};
          }
          this.setState(state);
        });
      }
    });
  };

  getStr1Count = () => {
    let request = {janus: "list_sessions", transaction: genUUID(), admin_secret: ADMIN_SECRET};
    fetch(`${ADMIN_SRV_STR1}`, {
      method: "POST",
      headers: {"Content-Type": "application/json"},
      body: JSON.stringify(request),
    }).then((response) => {
      if (response.ok) {
        return response.json().then((data) => {
          this.setState({str1_count: data.sessions.length});
        });
      }
    });
  };

  render() {
    const {android_count, ios_count, web_count} = this.props;
    const {
      gxy1_count,
      gxy2_count,
      gxy3_count,
      gxy4_count,
      gxy5_count,
      gxy6_count,
      gxy7_count,
      gxy8_count,
      gxy9_count,
      gxy10_count,
      gxy11_count,
      gxy12_count,
      str1_count,
      str2_count,
      str3_count,
      str4_count,
      str5_count,
      str6_count,
      str7_count,
      str8_count,
      str9_count,
    } = this.state;

    return (
      <Label attached="top right" size="small" className="gxy_count">
        <Table compact="very">
          <Table.Body>
            <Table.Row>
              <Table.Cell>Web Clients :</Table.Cell>
              <Table.Cell warning>{web_count}</Table.Cell>
              <Table.Cell>|</Table.Cell>
              <Table.Cell>gxy1 :</Table.Cell>
              <Table.Cell positive>{gxy1_count}</Table.Cell>
              <Table.Cell>gxy4 :</Table.Cell>
              <Table.Cell positive>{gxy4_count}</Table.Cell>
              <Table.Cell>gxy7 :</Table.Cell>
              <Table.Cell positive>{gxy7_count}</Table.Cell>
              <Table.Cell>gxy10 :</Table.Cell>
              <Table.Cell positive>{gxy10_count}</Table.Cell>
              <Table.Cell>|</Table.Cell>
              <Table.Cell>str1 :</Table.Cell>
              <Table.Cell error>{str1_count}</Table.Cell>
              <Table.Cell>str4 :</Table.Cell>
              <Table.Cell error>{str4_count}</Table.Cell>
              <Table.Cell>str7 :</Table.Cell>
              <Table.Cell error>{str7_count}</Table.Cell>
            </Table.Row>
            <Table.Row>
              <Table.Cell>iOS Clients :</Table.Cell>
              <Table.Cell warning>{ios_count}</Table.Cell>
              <Table.Cell>|</Table.Cell>
              <Table.Cell>gxy2 :</Table.Cell>
              <Table.Cell positive>{gxy2_count}</Table.Cell>
              <Table.Cell>gxy5 :</Table.Cell>
              <Table.Cell positive>{gxy5_count}</Table.Cell>
              <Table.Cell>gxy8 :</Table.Cell>
              <Table.Cell positive>{gxy8_count}</Table.Cell>
              <Table.Cell>gxy11 :</Table.Cell>
              <Table.Cell positive>{gxy11_count}</Table.Cell>
              <Table.Cell>|</Table.Cell>
              <Table.Cell>str2 :</Table.Cell>
              <Table.Cell error>{str2_count}</Table.Cell>
              <Table.Cell>str5 :</Table.Cell>
              <Table.Cell error>{str5_count}</Table.Cell>
              <Table.Cell>str8 :</Table.Cell>
              <Table.Cell error>{str8_count}</Table.Cell>
            </Table.Row>
            <Table.Row>
              <Table.Cell>Android Clients :</Table.Cell>
              <Table.Cell warning>{android_count}</Table.Cell>
              <Table.Cell>|</Table.Cell>
              <Table.Cell>gxy3 :</Table.Cell>
              <Table.Cell positive>{gxy3_count}</Table.Cell>
              <Table.Cell>gxy6 :</Table.Cell>
              <Table.Cell positive>{gxy6_count}</Table.Cell>
              <Table.Cell>gxy9 :</Table.Cell>
              <Table.Cell positive>{gxy9_count}</Table.Cell>
              <Table.Cell>gxy12 :</Table.Cell>
              <Table.Cell positive>{gxy12_count}</Table.Cell>
              <Table.Cell>|</Table.Cell>
              <Table.Cell>str3 :</Table.Cell>
              <Table.Cell error>{str3_count}</Table.Cell>
              <Table.Cell>str6 :</Table.Cell>
              <Table.Cell error>{str6_count}</Table.Cell>
              <Table.Cell>str9 :</Table.Cell>
              <Table.Cell error>{str9_count}</Table.Cell>
            </Table.Row>
          </Table.Body>
        </Table>
      </Label>
    );
  }
}

export default StatNotes;
