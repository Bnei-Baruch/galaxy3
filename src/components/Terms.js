import React, {
  useState,
} from 'react';
import {
  Button,
  Modal,
} from 'semantic-ui-react';
import { useTranslation } from 'react-i18next';

export const Terms = (props) => {
  const {t, i18n} = useTranslation();
  const [open, setOpen] = useState(false);

  const direction = i18n.language === 'he' ? 'rtl' : '';
  const textAlign = i18n.language === 'he' ? 'right' : '';
  const textAlignReverse = i18n.language === 'he' ? 'left' : '';

  const terms = {
    'en': '2PACX-1vRGxXGLrshOu57ifcb2bgCOnIhsgZAAnb_zXjiweD6XEre_s-hK7fa0Flx_FxUBsFK7unny6-1LNtH6',
    'es': '2PACX-1vRGxXGLrshOu57ifcb2bgCOnIhsgZAAnb_zXjiweD6XEre_s-hK7fa0Flx_FxUBsFK7unny6-1LNtH6',
    'he': '2PACX-1vS55LYnYroGyaFxx1ZnR9ftNOrmWbj8uh9PxYqGgNbxuK3wG3FwXwZkcYEJb6NOQQhcU8pv2XwH_D4K',
    'ru': '2PACX-1vQh_cPl4n5Ab5uMTiQ-NsAmzJ3Asxx3yl0sHxgXWVOYTB3aovHiB1UuwZTvP5Mc9F3xL0KRag0KkFie',
  };
  const src = `https://docs.google.com/document/d/e/${terms[i18n.language]}/pub?embedded=true`;

  return (
    <div style={{width: '100%', position: 'absolute', display: 'flex', justifyContent: 'center', bottom: '20px'}}>
      <a href="#" onClick={() => setOpen(true)}>{t('galaxyApp.terms')}</a>
      {!open ? null :
        <Modal open={true} style={{direction, textAlign}}>
          <Modal.Content style={{height: '500px'}}>
            <iframe frameBorder="0" width="100%" height="100%" src={src}></iframe>
          </Modal.Content>
          <Modal.Actions style={{textAlign: textAlignReverse}}>
            <Button color='green' onClick={() => setOpen(false)}>{t('galaxyApp.close')}</Button>
          </Modal.Actions>
        </Modal>
      }
    </div>
  );
}
