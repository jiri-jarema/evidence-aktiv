// js/state.js

// Objekt pro uchování stavu aplikace
export const state = {
    user: null,
    userRole: null,
    data: {}, // Celá datová struktura z Firebase
    agendas: [], // Pole všech agend pro snadnější přístup
    services: [], // Pole všech regulovaných služeb pro snadnější přístup
};
