import axios from "../api/request"

export async function postOssToken(bucket = "onionpad-cloud-control-large") {
  return await axios({
    method: "POST",
    url: `/yc-oss/token?bucket=${bucket}&expires=1800`
  })
}
