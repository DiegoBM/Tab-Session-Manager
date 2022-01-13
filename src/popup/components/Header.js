import React, { useContext, useMemo } from "react";
import _ from "lodash";
import browser from "webextension-polyfill";
import log from "loglevel";
import openUrl from "../actions/openUrl";
import { getSettings } from "src/settings/settings";
import DonationMessage from "./DonationMessage";
import { sendUndoMessage, sendRedoMessage, sendActiveSessionMessage } from "../actions/controlSessions";
import NameContainer from "./NameContainer";
import ClearIcon from "../../options/icons/clear.svg";
import UndoIcon from "../icons/undo.svg";
import RedoIcon from "../icons/redo.svg";
import HeartIcon from "../icons/heart.svg";
import CloudSyncIcon from "../icons/cloudSync.svg";
import ExpandIcon from "../icons/expand.svg";
import SettingsIcon from "../icons/settings.svg";
import "../styles/Header.scss";
import { useForceUpdate } from "../../common/hooks";
import { PopupContext } from "./PopupPage";

const logDir = "popup/components/Header";

const SyncStatus = props => {
  const { status, progress, total } = props.syncStatus;

  const statusLabels = {
    none: "",
    pending: `${browser.i18n.getMessage("syncingLabel")}...`,
    download: `${browser.i18n.getMessage("downloadingLabel")}...`,
    upload: `${browser.i18n.getMessage("uploadingLabel")}...`,
    delete: `${browser.i18n.getMessage("deletingLabel")}...`,
    complete: browser.i18n.getMessage("syncCompletedLabel"),
    signInRequired: browser.i18n.getMessage("signInRequiredLabel")
  };
  const shouldShowProgress = status === "download" || status === "upload" || status === "delete";

  return (
    <div className={`syncStatus ${status}`}>
      <span>{`${statusLabels[status]} ${shouldShowProgress ? `(${progress}/${total})` : ""}`}</span>
    </div>
  );
};

const openSettings = () => {
  log.info(logDir, "openSettings()");
  const url = "../options/index.html#settings";
  openUrl(url);
};

const openSessionListInTab = () => {
  log.info(logDir, "openSessionListInTab()");
  const url = "../popup/index.html#inTab";
  openUrl(url);
  window.close();
};

export default props => {
  const { openModal, syncStatus, needsSync, undoStatus } = props;
  const popupContext = useContext(PopupContext);
  const forceUpdate = useForceUpdate();

  const handleHeartClick = () => {
    openModal(browser.i18n.getMessage("donationLabel"), <DonationMessage />);
  };

  const handleSyncClick = async () => {
    await browser.runtime.sendMessage({
      message: "syncCloud"
    });
  };
  const handleUnsetActive = async () => {
    await sendActiveSessionMessage(null);
    forceUpdate(); // otherwise, this component doesn't know it should update
  };

  const shouldShowCloudSync = getSettings("signedInEmail");
  const syncError = syncStatus.status === "signInRequired";

  const shouldShowActiveSession = getSettings("keepTrackOfActiveSession");
  let activeSessionTitle = '';
  const activeSessionState = getSettings("activeSession");
  const activeSession = useMemo(
    () => activeSessionState && _.find(popupContext.sessions, {id:activeSessionState.id}), 
    [popupContext.sessions, activeSessionState]
  );
  console.debug('active session?',activeSessionState, activeSession, popupContext.sessions)
  if (shouldShowActiveSession) {
    const activeSessionName = activeSession ? activeSession.name : '_';
    const activeSessionLabel = browser.i18n.getMessage("activeSessionLabel");
    activeSessionTitle = `${activeSessionLabel}: ${activeSessionName}`
  }

  return (
    <div id="header">
      <div className="titleContainer">
        <div className="title">Tab Session Manager</div>
        {shouldShowActiveSession && (
          <div className="activeSessionTitle">
            <NameContainer
              canRename={false}
              forceTruncate={true}
              sessionName={activeSessionTitle} />
            {activeSession ? (
              <button
                className={`unsetActiveButton`}
                onClick={handleUnsetActive}
                title={browser.i18n.getMessage("unsetActiveLabel")}
              >
                <ClearIcon />
              </button>
            ) : null}
          </div>
        )}
      </div>
      <div className="rightButtons">
        {shouldShowCloudSync && <SyncStatus syncStatus={syncStatus} />}
        <button
          className={`undoButton ${undoStatus.undoCount == 0 ? "disable" : ""}`}
          onClick={sendUndoMessage}
          title={browser.i18n.getMessage("undoLabel")}
        >
          <UndoIcon />
          <div className="count">
            {undoStatus.undoCount > 0 && undoStatus.undoCount}
          </div>
        </button>
        <button
          className={`redoButton ${undoStatus.redoCount == 0 ? "disable" : ""}`}
          onClick={sendRedoMessage}
          title={browser.i18n.getMessage("redoLabel")}
        >
          <RedoIcon />
          <div className="count">
            {undoStatus.redoCount > 0 && undoStatus.redoCount}
          </div>
        </button>
        <div className="separation" />
        {shouldShowCloudSync && (
          <button
            className={"cloudSyncButton"}
            onClick={handleSyncClick}
            title={browser.i18n.getMessage("cloudSyncLabel")}
          >
            <CloudSyncIcon />
            {(needsSync || syncError) && <div className={`syncBadge ${syncError ? "syncError" : ""}`}>!</div>}
          </button>
        )}
        <button
          className="heartButton"
          onClick={handleHeartClick}
          title={browser.i18n.getMessage("donateLabel")}
        >
          <HeartIcon />
        </button>
        <button
          className={"openInTabButton"}
          onClick={openSessionListInTab}
          title={browser.i18n.getMessage("openSessionListInTabLabel")}
        >
          <ExpandIcon />
        </button>
        <button
          className={"settingsButton"}
          onClick={openSettings}
          title={browser.i18n.getMessage("settingsLabel")}
        >
          <SettingsIcon />
        </button>
      </div>
    </div>
  );
};
