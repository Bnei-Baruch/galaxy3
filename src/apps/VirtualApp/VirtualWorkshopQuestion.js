import React, {Component} from 'react';
import './VirtualWorkshopQuestion.scss'
import {Button, Icon} from 'semantic-ui-react';
import Dropdown from 'semantic-ui-react/dist/commonjs/modules/Dropdown';
import {withTranslation} from 'react-i18next';
import Flag from 'semantic-ui-react/dist/commonjs/elements/Flag';

const getFontSize = (el) => parseInt(getComputedStyle(el).getPropertyValue('font-size'));
const languageOptions = [
  {key: 'il', value: 'il', flag: 'il', text: 'עברית', content: 'עברית'},
  {key: 'ru', value: 'ru', flag: 'ru', text: 'Русский', content: 'Русский'}
];

class VirtualWorkshopQuestion extends Component {
  constructor(props) {
    super(props);

    this.state = {
      disableIncreaseFontSize: false,
      disableDecreaseFontSize: false,
      selectedLanguage: languageOptions[0],
      slide: null
    };

    this.questionRef = React.createRef();

    this.slideOut = this.slideOut.bind(this);
    this.slideIn = this.slideIn.bind(this);
    this.decreaseFontSize = this.decreaseFontSize.bind(this);
    this.increaseFontSize = this.increaseFontSize.bind(this);
    this.changeLanguage = this.changeLanguage.bind(this);

    // const ws = new WebSocket('wss://ktuviot.kbb1.com:4000/congress');
    // ws.onerror = function(event) {
    //   console.error("WebSocket error observed:", event);
    // };
  }

  slideOut() {
    this.setState({slide: 'out'});
  }

  slideIn() {
    this.setState({slide: 'in'});
  }

  increaseFontSize() {
    this.state.disableDecreaseFontSize && this.setState({disableDecreaseFontSize: false});

    const fontSize = getFontSize(this.questionRef.current);
    const nextFonSize = fontSize + 2;
    this.questionRef.current.style.fontSize = `${nextFonSize}px`;

    if (nextFonSize > 48) {
      this.setState({disableIncreaseFontSize: true});
    }
  }

  decreaseFontSize() {
    this.state.disableIncreaseFontSize && this.setState({disableIncreaseFontSize: false});

    const fontSize = getFontSize(this.questionRef.current);
    const nextFonSize = fontSize - 2;
    this.questionRef.current.style.fontSize = `${nextFonSize}px`;

    if (nextFonSize < 18) {
      this.setState({disableDecreaseFontSize: true});
    }
  }

  changeLanguage({value}) {
    const language = languageOptions.find((lang) => lang.value === value);
    this.setState({selectedLanguage: language});
  }

  render() {
    const {t} = this.props;
    const {disableIncreaseFontSize, disableDecreaseFontSize, selectedLanguage, slide} = this.state;

    let outerContainerClass = 'workshop-question-outer-container ';
    if (slide) outerContainerClass += slide;

    const languages = (
      <Dropdown selection
                selectOnBlur={false}
                options={languageOptions}
                onChange={(event, data) => this.changeLanguage(data)}
                trigger={<span><Flag name={selectedLanguage.flag}/> {selectedLanguage.text}</span>}
      />
    );

    return (
      <div className="workshop-question-overlay">
        <div className={outerContainerClass}>
          <div className="workshop-question-inner-container">
            <div className="workshop-tools">
              <div className="workshop-tools-left">
                <Button compact size='mini' title={t('oldClient.slideOut')} onClick={this.slideOut}>
                  <Icon name='chevron left'/>
                </Button>
              </div>
              <div className="workshop-tools-right">
                <Button.Group basic className="workshop-font-size-buttons">
                  <Button title={t('oldClient.increaseFontSize')}
                          onClick={this.increaseFontSize}
                          disabled={disableIncreaseFontSize}>A+</Button>
                  <Button title={t('oldClient.decreaseFontSize')}
                          onClick={this.decreaseFontSize}
                          disabled={disableDecreaseFontSize}>A-</Button>
                </Button.Group>
                {languages}
              </div>
            </div>
            <div className="workshop-question" ref={this.questionRef}>
              Lorem ipsum dolor sit amet, consectetur adipisicing elit. Ab accusantium adipisci aliquam dolorem eligendi
              libero quam quas quis recusandae, repellat reprehenderit tempore ullam, vel! Deleniti dicta est excepturi
              magnam molestiae nihil odio praesentium sequi ut vitae. Ducimus et illum inventore nemo obcaecati quam
              quidem recusandae! Eos esse facere maxime nulla.
            </div>
          </div>
          <Button compact size='mini' className="slide-in-btn" title={t('oldClient.slideIn')} onClick={this.slideIn}>
            <Icon name='chevron right'/>
          </Button>
        </div>
      </div>
    );
  }
}

export default withTranslation()(VirtualWorkshopQuestion);

