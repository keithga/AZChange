<%@ WebHandler Language="C#" Class="ReverseGeocodeProxy" %>

using System;
using System.Configuration;
using System.Diagnostics;
using System.Globalization;
using System.IO;
using System.Net;
using System.Web;

public class ReverseGeocodeProxy : IHttpHandler
{
    private const int RequestTimeoutMilliseconds = 30000;
    private const SecurityProtocolType Tls12 = (SecurityProtocolType)3072;

    private static readonly string ConfiguredUpstreamUrl =
        ConfigurationManager.AppSettings["ReverseGeocodeUpstreamUrl"] ?? "https://nominatim.openstreetmap.org/reverse";
    private static readonly string AllowedUpstreamHost =
        ConfigurationManager.AppSettings["ReverseGeocodeAllowedHost"] ?? "nominatim.openstreetmap.org";
    private static readonly string UpstreamUserAgent =
        ConfigurationManager.AppSettings["ReverseGeocodeUserAgent"] ?? "AZChange.org/1.0 (admin@AzChange.org)";

    public bool IsReusable
    {
        get { return true; }
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

        double latitude;
        double longitude;
        if (!TryParseCoordinate(context.Request.Form["lat"], -90.0, 90.0, out latitude) ||
            !TryParseCoordinate(context.Request.Form["lon"], -180.0, 180.0, out longitude))
        {
            context.Response.StatusCode = 400;
            context.Response.Write("{\"error\":\"Valid lat and lon parameters are required.\"}");
            return;
        }

        Uri baseUri;
        if (!Uri.TryCreate(ConfiguredUpstreamUrl, UriKind.Absolute, out baseUri) ||
            !string.Equals(baseUri.Scheme, Uri.UriSchemeHttps, StringComparison.OrdinalIgnoreCase) ||
            !string.Equals(baseUri.Host, AllowedUpstreamHost, StringComparison.OrdinalIgnoreCase))
        {
            context.Response.StatusCode = 500;
            context.Response.Write("{\"error\":\"Reverse geocode upstream URL is not configured correctly.\"}");
            return;
        }

        var query = HttpUtility.ParseQueryString(baseUri.Query ?? string.Empty);
        query["format"] = "jsonv2";
        query["lat"] = latitude.ToString("G17", CultureInfo.InvariantCulture);
        query["lon"] = longitude.ToString("G17", CultureInfo.InvariantCulture);

        var uriBuilder = new UriBuilder(baseUri) { Query = query.ToString() };

        try
        {
            ServicePointManager.SecurityProtocol |= Tls12;
            ServicePointManager.Expect100Continue = false;

            var upstreamRequest = (HttpWebRequest)WebRequest.Create(uriBuilder.Uri);
            upstreamRequest.Method = "GET";
            upstreamRequest.Timeout = RequestTimeoutMilliseconds;
            upstreamRequest.ReadWriteTimeout = RequestTimeoutMilliseconds;
            upstreamRequest.Accept = "application/json";
            upstreamRequest.UserAgent = UpstreamUserAgent;

            using (var upstreamResponse = (HttpWebResponse)upstreamRequest.GetResponse())
            {
                context.Response.StatusCode = (int)upstreamResponse.StatusCode;

                if (!string.IsNullOrWhiteSpace(upstreamResponse.ContentType))
                {
                    context.Response.ContentType = upstreamResponse.ContentType;
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
                : (webException.Status == WebExceptionStatus.Timeout
                    ? (int)HttpStatusCode.GatewayTimeout
                    : (int)HttpStatusCode.ServiceUnavailable);

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
                context.Response.Write("{\"error\":\"Unable to reach reverse geocode service.\"}");
            }
        }
        catch (Exception exception)
        {
            Trace.TraceError(
                "ReverseGeocodeProxy unexpected error: {0}: {1}",
                exception.GetType().FullName,
                exception.Message
            );
            context.Response.StatusCode = 500;
            context.Response.Write("{\"error\":\"Unexpected reverse geocode proxy error.\"}");
        }
    }

    private static bool TryParseCoordinate(string value, double min, double max, out double parsed)
    {
        if (!double.TryParse(value, NumberStyles.Float, CultureInfo.InvariantCulture, out parsed))
        {
            return false;
        }

        return parsed >= min && parsed <= max;
    }
}