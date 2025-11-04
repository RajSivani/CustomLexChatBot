"use-client";

import Api from "../(apiLayer)/Api";


class ChatbotDs {
  constructor() {
    this.api = new Api();
  }

  async ChatbotGet(data) {
   console.log("req obj in ds",data)
    try {
      const response = await this.api.postAPI( data, '/dev/start-webrtc');
       console.log("in ds layer ",response.data)
      if (response.status === 200) {
        return {
          success: true,
          data: response.data

        };
      } else {
        return {
          success: false,
          message: response.message || "Failed to save",
        };
      }
    } catch (error) {
      const errorMessage =
        error?.response?.data?.message?.message ||
        error?.response?.data?.message ||
        error?.message ||
        "Something went wrong.";
      console.log("error:", errorMessage);
      return { success: false, message: errorMessage };
    }
  }
  async ChatbotVedioGet() {
     try {
       const response = await this.api.getAPI('https://av6s1inbz7.execute-api.us-west-2.amazonaws.com/prod/generate');
      console.log("new ds response",response)
       if (response.status === 200) {
         return {
           success: true,
           data: response.data.body

         };
       } else {
         return {
           success: false,
           message: response.message || "Failed to save",
         };
       }
     } catch (error) {
 
       return { success: false, message: error };
     }
   }
}


export default ChatbotDs;
