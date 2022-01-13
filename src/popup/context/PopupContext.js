import React from "react";

export const PopupContext = React.createContext({
    sessions: [],
    modalOpen: false,
    closeModal: ()=>{throw new Error(`PopupContext not initialised`)},
});