import React, {useEffect, useState} from 'react';
import {Accordion, Box, AccordionSummary, Typography, AccordionDetails} from '@material-ui/core';
import {STUDY_MATERIALS} from "../../../shared/env"


const fetchMessages = async () => {
  try {
    const res = await fetch(STUDY_MATERIALS, {method: 'GET'});
    return res.json();
  } catch (e) {
    return null;
  }
};

const HomerLimud = () => {
  const [messages, setMessages] = useState([]);
  const [expanded, setExpanded] = useState();

  useEffect(() => {
    initMessages();
  }, []);

  const initMessages = async () => {
    const msgs = await fetchMessages();
    setMessages(msgs);
  };

  const handleAccordionChange = (name) => name !== expanded ? setExpanded(name) : setExpanded(null);

  const renderMessage = ({Title, Description: __html}, i) => {
    return (
      <Accordion key={i} expanded={expanded === `panel${i}`} onChange={() => handleAccordionChange(`panel${i}`)}>
        <AccordionSummary>
          <Typography>{Title}</Typography>
        </AccordionSummary>
        <AccordionDetails>
          <Typography style={{overflow: 'auto', fontSize: '0.8em', textOverflow: 'ellipsis'}}>
            <div dangerouslySetInnerHTML={{__html}}></div>
          </Typography>
        </AccordionDetails>
      </Accordion>
    );
  };

  return (
    <Box style={{height: 'calc(100vh - 140px)', overflow: 'auto'}}>
      {messages.map(renderMessage)}
    </Box>
  );

};

export default HomerLimud;
