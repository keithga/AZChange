<%@ WebHandler Language="C#" Class="AddressProxy" %>

using System;
using System.Diagnostics;
using System.IO;
using System.Net;
using System.Web;

public class AddressProxy : IHttpHandler
{
    private const string UpstreamUrl = "https://customsite.com/testapi/";
    private const int RequestTimeoutMilliseconds = 30000;

    public bool IsReusable
    {
        get { return false; }
    }

    public void ProcessRequest(HttpContext context)
    {
        context.Response.ContentType = "application/json";

        if (!string.Equals(context.Request.HttpMethod, "POST", StringComparison.OrdinalIgnoreCase))
        {
            context.Response.StatusCode = 405;
            context.Response.Write("{\"error\":\"Only POST is supported.\"}");
            return;
        }

        var address = context.Request.Form["address"];
        if (string.IsNullOrWhiteSpace(address))
        {
            address = context.Request["address"];
        }

        if (string.IsNullOrWhiteSpace(address))
        {
            context.Response.StatusCode = 400;
            context.Response.Write("{\"error\":\"The address parameter is required.\"}");
            return;
        }

        var upstreamBody = "address=" + HttpUtility.UrlEncode(address) + "&next=true";
        var requestBytes = System.Text.Encoding.UTF8.GetBytes(upstreamBody);

        try
        {
            var upstreamRequest = (HttpWebRequest)WebRequest.Create(UpstreamUrl);
            upstreamRequest.Method = "POST";
            upstreamRequest.Timeout = RequestTimeoutMilliseconds;
            upstreamRequest.ReadWriteTimeout = RequestTimeoutMilliseconds;
            upstreamRequest.ContentType = "application/x-www-form-urlencoded; charset=UTF-8";
            upstreamRequest.ContentLength = requestBytes.Length;

            using (var requestStream = upstreamRequest.GetRequestStream())
            {
                requestStream.Write(requestBytes, 0, requestBytes.Length);
            }

            using (var upstreamResponse = (HttpWebResponse)upstreamRequest.GetResponse())
            {
                context.Response.StatusCode = (int)upstreamResponse.StatusCode;

                var responseContentType = upstreamResponse.ContentType;
                if (!string.IsNullOrWhiteSpace(responseContentType))
                {
                    context.Response.ContentType = responseContentType;
                }

                using (var responseStream = upstreamResponse.GetResponseStream())
                {
                    if (responseStream == null)
                    {
                        context.Response.Write(string.Empty);
                    }
                    else
                    {
                        using (var reader = new StreamReader(responseStream))
                        {
                            context.Response.Write(reader.ReadToEnd());
                        }
                    }
                }
            }
        }
        catch (WebException webException)
        {
            var httpResponse = webException.Response as HttpWebResponse;
            context.Response.StatusCode = httpResponse != null
                ? (int)httpResponse.StatusCode
                : (webException.Status == WebExceptionStatus.Timeout ? 504 : 503);

            if (httpResponse != null)
            {
                using (var responseStream = httpResponse.GetResponseStream())
                {
                    if (responseStream == null)
                    {
                        context.Response.Write(string.Empty);
                    }
                    else
                    {
                        using (var reader = new StreamReader(responseStream))
                        {
                            context.Response.Write(reader.ReadToEnd());
                        }
                    }
                }
            }
            else
            {
                context.Response.Write("{\"error\":\"Unable to reach upstream service.\"}");
            }
        }
        catch (Exception exception)
        {
            Trace.TraceError("AddressProxy unexpected error: {0}", exception);
            context.Response.StatusCode = 500;
            context.Response.Write("{\"error\":\"Unexpected proxy error.\"}");
        }
    }
}
