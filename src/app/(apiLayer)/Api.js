'use client';
import AWS from 'aws-sdk';
import Axios from 'axios';
import CryptoJS from "crypto-js";

class Api {

  constructor(successAPICallBack, failureAPICallBack) {
    this.successCallBack = successAPICallBack
    this.failureCallBack = failureAPICallBack
  }


  encryptData = (data, secretKey) => {
    return CryptoJS.AES.encrypt(JSON.stringify(data), secretKey).toString();
  };

  // Utility method for decryption
  decryptData = (encryptedData, secretKey) => {
    const decryptedBytes = CryptoJS.AES.decrypt(encryptedData, secretKey);
    const decryptedString = decryptedBytes.toString(CryptoJS.enc.Utf8);
    return JSON.parse(decryptedString);
  };

  postAPI = (requestData, path) => {
    try {
      const endpoint = process.env.NEXT_PUBLIC_AWS_ENDPOINT;
      const region = process.env.NEXT_PUBLIC_AWS_REGION;
      const request = new AWS.HttpRequest(endpoint, region);
      request.method = 'POST';
      request.path = path;
      request.headers = {
        host: request.endpoint.host,
      };
      request.body = JSON.stringify(requestData);
      const credentials = new AWS.Credentials({
        accessKeyId: process.env.NEXT_PUBLIC_AWS_ACCESS_KEY_ID,
        secretAccessKey: process.env.NEXT_PUBLIC_AWS_SECRET_ACCESS_KEY,
      });
      const signer = new AWS.Signers.V4(request, 'execute-api');
      signer.addAuthorization(credentials, new Date());
      const headers = request.headers;
      delete headers.host;

      // Return the Axios promise
      return Axios({
        url: endpoint + request.path,
        headers: { ...headers, 'Content-Type': 'application/json' },
        data: JSON.stringify(requestData),
        method: 'POST',
      })
        .then((response) => {
          console.log(response);
          return response;  // Ensure the response is returned
        })
        .catch((error) => {
          console.log('Error fetching batch data 1:', error);
          throw error;  // Rethrow the error to handle it in the calling function
        });
    } catch (error) {
      console.log('Error fetching batch data:', error);
      throw error;  // Rethrow the error to handle it in the calling function
    }
  }



  getAPI = async (endPoint) => {

    try {

      AWS.config.update({
        region: process.env.NEXT_PUBLIC_AWS_REGION_SIVANI, // Update with your AWS region
        accessKeyId: process.env.NEXT_PUBLIC_AWS_ACCESS_KEY_ID_SIVANI,
        secretAccessKey: process.env.NEXT_PUBLIC_AWS_SECRET_ACCESS_KEY_SIVANI,
      });

      // Create an Axios instance with AWS Signature Version 4 interceptor
      const axiosWithAuth = Axios.create();
      axiosWithAuth.interceptors.request.use(async (config) => {
        const endpoint = endPoint
        const region = process.env.NEXT_PUBLIC_AWS_REGION_SIVANI;

        // Create an AWS HttpRequest object
        const request = new AWS.HttpRequest(endpoint, region);
        request.method = 'GET';
        request.headers = {
          host: request.endpoint.host,
        };

        // Sign the request using AWS Signature Version 4
        const signer = new AWS.Signers.V4(request, 'execute-api');
        signer.addAuthorization(AWS.config.credentials, new Date());
        const headers = request.headers;
        delete headers.host;

        // Set AWS headers in the Axios request
        config.headers = {
          ...config.headers,
          ...headers,
        };

        return config;
      });

      // Fetch redaction data using Axios with AWS headers
      const response = await axiosWithAuth.get(endPoint);
      console.log("new api response",response)
      return response;
    } catch (error) {
      return error;
    }

  }

  postAPINew = (requestData, path) => {
    try {
      const endpoint = process.env.NEXT_PUBLIC_AWS_ENDPOINT;
      const region = process.env.NEXT_PUBLIC_AWS_REGION;
      const request = new AWS.HttpRequest(endpoint, region);
      request.method = 'POST';
      request.path = path;
      request.headers = {
        host: request.endpoint.host,
      };
      request.body = JSON.stringify(requestData);
      const credentials = new AWS.Credentials({
        accessKeyId: process.env.NEXT_PUBLIC_AWS_ACCESS_KEY_ID,
        secretAccessKey: process.env.NEXT_PUBLIC_AWS_SECRET_ACCESS_KEY,
      });
      const signer = new AWS.Signers.V4(request, 'execute-api');
      signer.addAuthorization(credentials, new Date());
      const headers = request.headers;
      delete headers.host;

      // Return the Axios promise
      return Axios({
        url: endpoint + request.path,
        headers: { ...headers, 'Content-Type': 'application/json' },
        data: JSON.stringify(requestData),
        method: 'POST',
      })
        .then((response) => {
          console.log(response);
          return response;  // Ensure the response is returned
        })
        .catch((error) => {
          console.log('Error fetching batch data:', error);
          throw error;  // Rethrow the error to handle it in the calling function
        });
    } catch (error) {
      console.log('Error fetching batch data:', error);
      throw error;  // Rethrow the error to handle it in the calling function
    }
  }

  postAPIEnvlope(requestData, path) {
    try {
      const secretKey = process.env.NEXT_PUBLIC_AWS_SECRET_KEY;
      const encryptedData = this.encryptData(requestData, secretKey); // string output
      console.log("request data", requestData);
  
      const endpoint = process.env.NEXT_PUBLIC_AWS_ENDPOINT;
      const region = process.env.NEXT_PUBLIC_AWS_REGION;
  
      const request = new AWS.HttpRequest(endpoint, region);
      request.method = 'POST';
      request.path = path;
      request.headers = {
        host: request.endpoint.host,
        'Content-Type': 'text/plain', // <-- Send as plain text
      };
      request.body = encryptedData;
  
      const credentials = new AWS.Credentials({
        accessKeyId: process.env.NEXT_PUBLIC_AWS_ACCESS_KEY_ID,
        secretAccessKey: process.env.NEXT_PUBLIC_AWS_SECRET_ACCESS_KEY,
      });
  
      const signer = new AWS.Signers.V4(request, 'execute-api');
      signer.addAuthorization(credentials, new Date());
  
      const headers = request.headers;
      delete headers.host;
  
      return Axios({
        url: endpoint + request.path,
        headers: { ...headers, 'Content-Type': 'text/plain' }, // text/plain
        data: encryptedData, // not JSON.stringify
        method: 'POST',
      })
        .then((response) => {
          const decryptedData = this.decryptData(response.data, secretKey);
          return decryptedData;
        })
        .catch((error) => {
          console.log('Error posting encrypted data:', error);
          throw error;
        });
    } catch (error) {
      console.log('Error in postAPIEnvlope:', error);
      throw error;
    }
  }
  



}


export default Api;