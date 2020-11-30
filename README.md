# fseconomy Assignment Finder

_Plugin to help you find your preferred assignments in fseconomy quicker._

## Usage

1. Browse to [fseconomy](https://server.fseconomy.net/).
1. Use the Airport Search to obtain a list of possible airports OR browse to the page of an airport.
1. Open the plugin popup (right next to the browser's URL).
1. Hit 'Search'.

If you want to restart the search, you don't need to reload the page. Just hist 'Search' in the plugin popup again.

## Development installation

### Debug

1. Open Firefox and browse to [about:debugging#/runtime/this-firefox](about:debugging#/runtime/this-firefox).
1. Click 'Load Temporary Add-on'.
1. Select the 'manifest.json' file from this plugin.

You need to click 'Reload' after every content script and manifest change.

### Export 

Creating .zip file:
```bash
zip -r -FS output/fseconomyAssignmentFinder.zip * -x '*.git*' -x 'output/' -x 'modal.html' -x 'README.md' -x '*.xcf'
```
