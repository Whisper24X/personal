package fileutil

import (
	"context"
	"fmt"
	"io"
	"net/http"
	"testing"
)

func TestReadUrlFileLineToSli(t *testing.T) {
	url := "https://onionpad-cloud-control-large.yangcong345.com/device/feedback/Screenshot_20240608-175725-e2ecaf02286f22fb36e9424405cae38b__w.png"
	req, err := http.NewRequestWithContext(context.Background(), http.MethodGet, url, http.NoBody)
	if err != nil {
		fmt.Println(err)
	}
	resp, err := http.DefaultClient.Do(req)
	if err != nil {
		fmt.Println(err)
	}
	defer resp.Body.Close()
	all, err := io.ReadAll(resp.Body)
	if err != nil {
		fmt.Println(err)
	}
	fmt.Println(all)
}
