import React, {Component} from "react";
import {Label, Table, Icon} from "semantic-ui-react";
import {ADMIN_SECRET, ADMIN_SRV_STR1, MONITOR_SRV} from "../../../shared/env";
import {genUUID} from "../../../shared/tools";

class StatNotes extends Component {
  state = {};

  componentDidMount() {
    let state = {gxy_sum: 0, str_sum: 0};
    for (let i = 1; i < 8; i++) {
      state["gxy" + i + "_count"] = 0;
      state["str" + i + "_count"] = 0;
    }
    this.setState({...state});
    // setInterval(this.getCounts, 10 * 1000);
    setInterval(this.getStr1Count, 10 * 1000);
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
    const {android_count,ios_count,web_count} = this.props;
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
      str1_count,
      str2_count,
      str3_count,
      str4_count,
      str5_count,
      str6_count,
      str7_count,
      str8_count,
      str9_count,
      str10_count,
      str11_count,
      gxy_sum,
      str_sum,
    } = this.state;

    const i = <Icon name="heart" size="small" />;

    return (
      <Label attached="top right" size='small' className="gxy_count">
        <Table compact="very">
          <Table.Header>
            <Table.Row>
              <Table.HeaderCell />
              <Table.HeaderCell />
              <Table.HeaderCell />
              {/*<Table.HeaderCell />*/}
            </Table.Row>
          </Table.Header>
          <Table.Body>
            <Table.Row>
              <Table.Cell>Web Clients :</Table.Cell>
              <Table.Cell>{web_count}</Table.Cell>
              {/*<Table.Cell>gxy5 :</Table.Cell>*/}
              {/*<Table.Cell>{gxy5_count}</Table.Cell>*/}
              {/*<Table.Cell>gxy9 :</Table.Cell>*/}
              {/*<Table.Cell>{gxy9_count}</Table.Cell>*/}
              {/*<Table.Cell>|</Table.Cell>*/}
              <Table.Cell>str1 :</Table.Cell>
              <Table.Cell>{str1_count}</Table.Cell>
              {/*<Table.Cell>str5 :</Table.Cell>*/}
              {/*<Table.Cell>{str5_count}</Table.Cell>*/}
              {/*<Table.Cell>str9 :</Table.Cell>*/}
              {/*<Table.Cell>{str9_count}</Table.Cell>*/}
            </Table.Row>
            <Table.Row>
              <Table.Cell>iOS Clients :</Table.Cell>
              <Table.Cell>{ios_count}</Table.Cell>
              {/*<Table.Cell>gxy6 :</Table.Cell>*/}
              {/*<Table.Cell>{gxy6_count}</Table.Cell>*/}
              {/*<Table.Cell>gxy10 :</Table.Cell>*/}
              {/*<Table.Cell>{gxy10_count}</Table.Cell>*/}
              {/*<Table.Cell>|</Table.Cell>*/}
              {/*<Table.Cell>str2 :</Table.Cell>*/}
              {/*<Table.Cell>{str2_count}</Table.Cell>*/}
              {/*<Table.Cell>str6 :</Table.Cell>*/}
              {/*<Table.Cell>{str6_count}</Table.Cell>*/}
              {/*<Table.Cell>str10 :</Table.Cell>*/}
              {/*<Table.Cell>{str10_count}</Table.Cell>*/}
            </Table.Row>
            <Table.Row>
              <Table.Cell>Android Clients :</Table.Cell>
              <Table.Cell>{android_count}</Table.Cell>
              {/*<Table.Cell>gxy7 :</Table.Cell>*/}
              {/*<Table.Cell>{gxy7_count}</Table.Cell>*/}
              {/*<Table.Cell>gxy11 :</Table.Cell>*/}
              {/*<Table.Cell>{gxy11_count}</Table.Cell>*/}
              {/*<Table.Cell>|</Table.Cell>*/}
              {/*<Table.Cell>str3 :</Table.Cell>*/}
              {/*<Table.Cell>{str3_count}</Table.Cell>*/}
              {/*<Table.Cell>str7 :</Table.Cell>*/}
              {/*<Table.Cell>{str7_count}</Table.Cell>*/}
              {/*<Table.Cell>str11 :</Table.Cell>*/}
              {/*<Table.Cell>{str11_count}</Table.Cell>*/}
            </Table.Row>
            {/*<Table.Row>*/}
            {/*  <Table.Cell>gxy4 :</Table.Cell>*/}
            {/*  <Table.Cell>{gxy4_count}</Table.Cell>*/}
            {/*  <Table.Cell>gxy8 :</Table.Cell>*/}
            {/*  <Table.Cell>{gxy8_count}</Table.Cell>*/}
            {/*  /!*<Table.Cell>sum :</Table.Cell>*!/*/}
            {/*  /!*<Table.Cell>{gxy_sum}</Table.Cell>*!/*/}
            {/*  <Table.Cell>|</Table.Cell>*/}
            {/*  <Table.Cell>str4 :</Table.Cell>*/}
            {/*  <Table.Cell>{str4_count}</Table.Cell>*/}
            {/*  <Table.Cell>str8 :</Table.Cell>*/}
            {/*  <Table.Cell>{str8_count}</Table.Cell>*/}
            {/*  /!*<Table.Cell>sum :</Table.Cell>*!/*/}
            {/*  /!*<Table.Cell>{str_sum}</Table.Cell>*!/*/}
            {/*</Table.Row>*/}
          </Table.Body>
        </Table>
      </Label>
    );
  }
}

export default StatNotes;
