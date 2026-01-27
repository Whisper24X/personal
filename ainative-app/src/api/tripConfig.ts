import axios from "./request"

export const getTripConfig = async (key: string): Promise<any> => {
  return axios({
    baseUrl: "https://device-api.yangcong345.com",
    url: "/devices-learn/learn-config/v1/queryLearnConfigByKey",
    method: "POST",
    data: {
      key: [key]
    }
  })
}
