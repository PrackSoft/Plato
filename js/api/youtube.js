// js/api/youtube.js
import { API_KEY } from '../config.js';

const MAX_RESULTS_PER_PAGE = 50;

export async function searchYouTube(query, channelId = null) {
    if (!query || query.trim() === "") {
        throw new Error("Search query cannot be empty");
    }
    let url = `https://www.googleapis.com/youtube/v3/search?part=snippet&type=video&maxResults=${MAX_RESULTS_PER_PAGE}&q=${encodeURIComponent(query)}&key=${API_KEY}`;
    if (channelId) {
        url += `&channelId=${channelId}`;
    }
    const searchResponse = await fetch(url);
    const searchData = await searchResponse.json();
    if (!searchData.items || searchData.items.length === 0) return [];

    const videoIds = searchData.items.map(item => item.id.videoId).filter(id => id);
    const videosUrl = `https://www.googleapis.com/youtube/v3/videos?part=snippet,statistics,contentDetails&id=${videoIds.join(',')}&key=${API_KEY}`;
    const videosResponse = await fetch(videosUrl);
    const videosData = await videosResponse.json();

    const detailsMap = new Map();
    if (videosData.items) {
        videosData.items.forEach(video => {
            detailsMap.set(video.id, {
                fullDescription: video.snippet.description,
                tags: video.snippet.tags || [],
                viewCount: video.statistics?.viewCount || 'N/A',
                likeCount: video.statistics?.likeCount || 'N/A',
                commentCount: video.statistics?.commentCount || 'N/A',
                duration: video.contentDetails?.duration || 'N/A',
                channelId: video.snippet.channelId,
                channelTitle: video.snippet.channelTitle,
                title: video.snippet.title,
                publishedAt: video.snippet.publishedAt,
                thumbnails: video.snippet.thumbnails
            });
        });
    }

    const enrichedItems = searchData.items.map(item => {
        const videoId = item.id.videoId;
        const extra = detailsMap.get(videoId) || {};
        return {
            youtubeId: videoId,
            title: extra.title || item.snippet.title,
            channelId: extra.channelId || item.snippet.channelId,
            channelTitle: extra.channelTitle || item.snippet.channelTitle,
            imageUrl: extra.thumbnails?.medium?.url || item.snippet.thumbnails.medium.url,
            url: `https://youtube.com/watch?v=${videoId}`,
            description: extra.fullDescription || item.snippet.description,
            publishedAt: extra.publishedAt || item.snippet.publishedAt,
            duration: extra.duration,
            viewCount: extra.viewCount,
            likeCount: extra.likeCount,
            commentCount: extra.commentCount,
            tags: extra.tags
        };
    });
    return enrichedItems;
}