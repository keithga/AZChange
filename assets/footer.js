(function () {

  // #region Footer Loading Logic

  const FOOTER_MOUNT_ID = 'site-footer';
  const FOOTER_CACHE_KEY = 'sharedFooterMarkup';
  const FOOTER_FETCH_TIMEOUT_MS = 5000;

  const getFooterNodes = (markup) => {
    const doc = new DOMParser().parseFromString(markup, 'text/html');
    if (!doc.body.firstElementChild) {
      return null;
    }
    return Array.from(doc.body.childNodes);
  };

  const renderFooter = (mount, markup) => {
    const nodes = getFooterNodes(markup);
    if (!nodes) return false;
    mount.replaceChildren(...nodes);
    return true;
  };

  const loadSharedFooter = async () => {
    const mount = document.getElementById(FOOTER_MOUNT_ID);
    if (!mount) return;

    const assets = mount.getAttribute('path') ?? '../assets';

    const fallbackFooterMarkup = `
<footer class="site-footer">
    <h2>Take Action</h2>
    <p>Which candidates are ready to tackle the issues you care about?</p>
    <a class="topic-link" href="${assets}/../address-lookup/">Candidate Lookup</a> &nbsp;&nbsp;

    <h2>Learn More</h2>
    <a class="topic-link" href="${assets}/../voter-information/">Voter Information</a> &nbsp;&nbsp;
    <a class="topic-link" href="${assets}/../media-resources/">AZChange Media Resources</a>
<p class="disclaimer">A voter outreach initiative of <a href="https://pimadems.org" style="text-decoration: none; color: inherit; font-weight: inherit;" >PCDP</a>, Brian Bickel Treasurer. Not authorized by any candidate or candidate's committee.</p>
  
</footer>
<p>&nbsp;</p>
`;

    renderFooter(mount, fallbackFooterMarkup);
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', loadSharedFooter, { once: true });
  } else {
    loadSharedFooter();
  }

  // #endregion

  // #region Load topic from URL and store in session for use in card rendering. Only run lookup logic on address-lookup page.

  if ( document.body.hasAttribute('data-topic') ) {
    const topic = document.body.getAttribute('data-topic');
    console.log("User Selected Topic:", topic);
    sessionStorage.setItem('selectedTopic', topic );
  }

  // #endregion


})();
