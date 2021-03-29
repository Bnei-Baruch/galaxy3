import React, {Component} from "react";
import {Message} from "semantic-ui-react";
import Slider from "react-rangeslider";
import "./VolumeSlider.css";

class VolumeSlider extends Component {
  state = {
    value: 1,
  };

  handleOnChange = (value) => {
    this.setState({value});
    this.props.volume(value);
  };
  render() {
    const {value} = this.state;

    return (
      <Message>
        <Slider
          type="range"
          min={0.01}
          max={1}
          step={0.01}
          value={value}
          tooltip={false}
          orientation="horizontal"
          onChange={this.handleOnChange}
        ></Slider>
      </Message>
    );
  }
}

export default VolumeSlider;
