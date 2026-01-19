import { createAuthAxios } from './axios-config';

export interface Yell {
  id: string;
  scene_id: string;
  content: string;
  latitude: number;
  longitude: number;
  expires_at: number;
  created_at: number;
  persona_name?: string;
  persona_avatar?: string;
}

export interface BroadcastYellResponse {
  id: string;
  scene_id: string;
  content: string;
  latitude: number;
  longitude: number;
  expires_at: number;
  next_yell_at: number;
}

export interface NearbyYellsResponse {
  yells: Yell[];
  count: number;
}

export const yellsApi = {
  broadcast: async (content: string): Promise<BroadcastYellResponse> => {
    const api = createAuthAxios();
    const response = await api.post('/yells/broadcast', { content });
    return response.data;
  },

  getNearby: async (): Promise<NearbyYellsResponse> => {
    const api = createAuthAxios();
    const response = await api.get('/yells/nearby');
    return response.data;
  },
};
