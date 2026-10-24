"""Imported by the browser tests that resize the page after a tap (pwreplay, pwbw, pwtourney, pwquick, pwstakes).
Playwright 1.63 (the cloud container's, with Chromium 1243) resizes the browser window for set_viewport_size, and Chromium refuses
that while the page is fullscreen ("To resize minimized/maximized/fullscreen window, restore it to normal state first"); the game goes
fullscreen on a tap (goFull). So every resize leaves fullscreen first, the way a person would."""
from playwright.async_api import Page

_resize = Page.set_viewport_size

async def set_viewport_size(self, viewport_size):
    if await self.evaluate("document.fullscreenElement ? document.exitFullscreen().then(() => true) : false"):
        await self.wait_for_timeout(200)
    await _resize(self, viewport_size)

Page.set_viewport_size = set_viewport_size
