// js/channels.js
// List of available YouTube channels for searching and filtering

export const CHANNELS = [
    {
        id: null,           // null means "search all channels" (no channelId filter)
        name: "All Channels"
    },
    {
        id: "UCuVPpxrm2VAgpH3Ktln4HXg",
        name: "YouTube Free Movies"
    }
    // Add more channels here as needed
];

// Helper: get channel name by ID
export function getChannelName(channelId) {
    const found = CHANNELS.find(ch => ch.id === channelId);
    return found ? found.name : "Unknown Channel";
}