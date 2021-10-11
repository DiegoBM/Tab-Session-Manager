import browser from "webextension-polyfill";
import browserInfo from "browser-info";
import uuidv4 from "uuid/v4";
import log from "loglevel";
import { SessionStartTime } from "./background.js";
import Sessions from "./sessions.js";
import { getSettings, setSettings } from "src/settings/settings";
import { returnReplaceParameter } from "./replace.js";
import ignoreUrls from "./ignoreUrls";
import { pushRemovedQueue, syncCloudAuto } from "./cloudSync.js";
import { getValidatedTag } from "./tag.js";
import { queryTabGroups } from "../common/tabGroups";
import { compressDataUrl } from "../common/compressDataUrl";

const logDir = "background/save";

const isEnabledTabGroups = browserInfo().name == "Chrome" && browserInfo().version >= 89;

export async function saveCurrentSession(name, tag, property) {
  log.log(logDir, "saveCurrentSession()", name, tag, property);
  const session = await loadCurrentSession(name, tag, property).catch(() => {
    return Promise.reject();
  });

  // When the user saves the current session, s/he's implicitly setting the active
  // session, if the Setting to track the active session is enabled
  setSettings('activeSession', getSettings("keepTrackOfActiveSession")
    ? {name: session.name, id: session.id, sessionStartTime: Date.now()}
    : null);

  return await saveSession(session);
}

export async function loadCurrentSession(name, tag, property) {
  log.log(logDir, "loadCurrentSession()", name, tag, property);
  let session = {
    windows: {},
    windowsNumber: 0,
    windowsInfo: {},
    tabsNumber: 0,
    name: name,
    date: Date.now(),
    lastEditedTime: Date.now(),
    tag: tag,
    sessionStartTime: SessionStartTime,
    id: uuidv4()
  };

  let queryInfo = {};
  switch (property) {
    case "saveAllWindows":
      break;
    case "saveOnlyCurrentWindow":
      queryInfo.currentWindow = true;
  }

  const tabs = await browser.tabs.query(queryInfo);
  for (let tab of tabs) {
    //プライベートタブを無視
    if (!getSettings("ifSavePrivateWindow")) {
      if (tab.incognito) {
        continue;
      }
    }

    if (session.windows[tab.windowId] == undefined) session.windows[tab.windowId] = {};

    //replacedPageなら元のページを保存
    const parameter = returnReplaceParameter(tab.url);
    if (parameter.isReplaced) {
      tab.url = parameter.url;
    }

    // Compress favicon url
    if (getSettings("compressFaviconUrl") && tab?.favIconUrl?.startsWith("data:image")) {
      const compressedDataUrl = await compressDataUrl(tab.favIconUrl);
      tab.favIconUrl = compressedDataUrl;
    }

    session.windows[tab.windowId][tab.id] = tab;
    session.tabsNumber++;
  }

  session.windowsNumber = Object.keys(session.windows).length;

  for (let i in session.windows) {
    const window = await browser.windows.get(parseInt(i));
    session.windowsInfo[i] = window;
  }

  if (isEnabledTabGroups && getSettings("saveTabGroups")) {
    const tabGroups = await queryTabGroups();
    const filteredTabGroups = tabGroups.filter(tabGroup =>
      Object.keys(session.windows).includes(String(tabGroup.windowId)));
    if (filteredTabGroups.length > 0) session.tabGroups = filteredTabGroups;
  }

  const ignoredUrlSession = ignoreUrls(session);

  return new Promise((resolve, reject) => {
    if (session.tabsNumber > 0) resolve(ignoredUrlSession);
    else reject();
  });
}

async function sendMessage(message, options = {}) {
  await browser.runtime
    .sendMessage({
      message: message,
      ...options
    })
    .catch(() => { });
}

export async function saveSession(session, isSendResponce = true, saveBySync = false) {
  log.log(logDir, "saveSession()", session, isSendResponce);
  try {
    const shouldSaveDeviceName = getSettings("shouldSaveDeviceName");
    if (shouldSaveDeviceName && !saveBySync) {
      const deviceName = getSettings("deviceName");
      const validatedTag = getValidatedTag(deviceName, session);
      if (validatedTag !== "") session.tag.push(deviceName);
    }
    await Sessions.put(session);
    if (isSendResponce) {
      sendMessage("saveSession", { session: session, saveBySync: saveBySync });
      if (!saveBySync) syncCloudAuto();
    }
    return session;
  } catch (e) {
    log.error(logDir, "saveSession()", e);
    return Promise.reject(e);
  }
}

export async function removeSession(id, isSendResponce = true) {
  log.log(logDir, "removeSession()", id, isSendResponce);
  try {
    // Remove the active session setting if the id matches, regardless of whether
    // we are tracking the active session or not.
    const activeSession = getSettings("activeSession");
    if (activeSession && activeSession.id === id) {
      setSettings('activeSession', null);
    }

    await Sessions.delete(id);
    pushRemovedQueue(id);
    if (isSendResponce) sendMessage("deleteSession", { id: id });
  } catch (e) {
    log.error(logDir, "removeSession()", e);
    return Promise.reject(e);
  }
}

export async function updateSession(
  session,
  isSendResponce = true,
  shouldUpdateEditedTime = true,
  saveBySync = false
) {
  log.log(logDir, "updateSession()", session, isSendResponce, shouldUpdateEditedTime);
  try {
    if (shouldUpdateEditedTime) session.lastEditedTime = Date.now();
    await Sessions.put(session);
    if (isSendResponce) sendMessage("updateSession", { session: session, saveBySync: saveBySync });
    return session;
  } catch (e) {
    log.error(logDir, "updateSession()", e);
    return Promise.reject(e);
  }
}

export async function renameSession(id, name) {
  log.log(logDir, "renameSession()", id, name);
  let session = await Sessions.get(id).catch(() => { });
  if (session == undefined) return;
  session.name = name.trim();
  return await updateSession(session);
}

export async function deleteAllSessions() {
  log.log(logDir, "deleteAllSessions()");
  try {
    await Sessions.deleteAll();
    sendMessage("deleteAll");
  } catch (e) {
    log.error(logDir, "deleteAllSessions()", e);
  }
}
