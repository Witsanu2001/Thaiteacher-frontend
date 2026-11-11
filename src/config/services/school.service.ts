
import axios from "axios";

const API_URL = import.meta.env.VITE_API_URL ?? "";

export interface School {
  id: number;
  name: string;
  code: string;
}

export async function getSchools(): Promise<School[]> {
  const response = await axios.get<School[]>(
    `${API_URL}/api/v1/schools`
  );

  return response.data;
}
