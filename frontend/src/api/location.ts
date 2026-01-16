// Location API Client
import { createAuthAxios } from './axios-config';

export interface LocationUpdate {
    latitude: number;
    longitude: number;
    accuracy?: number;
}

export const locationApi = {
    // Update user location
    updateLocation: async (location: LocationUpdate): Promise<{ message: string }> => {
        const api = createAuthAxios();
        const response = await api.post<{ message: string }>('/location/update', location);
        return response.data;
    },
};
