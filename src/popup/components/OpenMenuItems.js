import React from "react";
import browser from "webextension-polyfill";
import {
  sendOpenMessage,
} from "../actions/controlSessions";
import { PopupContext } from "../context/PopupContext";
import NewWindowIcon from "../icons/newWindow.svg";

export default props => {
  const popupContext = useContext(PopupContext);

  const handleOpenInNewWindow = () => {
    sendOpenMessage(props.session.id, "openInNewWindow");
    popupContext.closeModal()
  };
  const handleOpenInCurrentWindow = () => {
    sendOpenMessage(props.session.id, "openInCurrentWindow");
    popupContext.closeModal()
  };
  const handleAddToCurrentWindow = () => {
    sendOpenMessage(props.session.id, "addToCurrentWindow");
    popupContext.closeModal()
  };
  const handleClickSection = e => {
    e.stopPropagation();
  };

  return (
    <ul>
      <li className="section" onClick={handleClickSection}>
        <NewWindowIcon />
        {browser.i18n.getMessage("openSessionLabel")}
      </li>
      <li>
        <button onClick={handleOpenInNewWindow}>
          {browser.i18n.getMessage("openInNewWindowLabel")}
        </button>
      </li>
      <li>
        <button onClick={handleOpenInCurrentWindow}>
          {browser.i18n.getMessage("openInCurrentWindowLabel")}
        </button>
      </li>
      <li>
        <button onClick={handleAddToCurrentWindow}>
          {browser.i18n.getMessage("addToCurrentWindowLabel")}
        </button>
      </li>
    </ul>
  );
};
