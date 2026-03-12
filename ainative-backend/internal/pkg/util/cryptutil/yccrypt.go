package cryptutil

import (
	yccrypt "gitlab.yc345.tv/backend/yccrypt/go"
)

const (
	phoneSecret = "f3d746f00d0945c3a6edb9dc21f4b91f"
	cardSecret  = "70d1ea9493124d9c88ec310134b44eed"
	otherSecret = "c55b3293c9aa4ea0937a8ebfe7d3a411"
)

func YcPhoneItemEncrypt(phoneItem string) (string, error) {
	if phoneItem == "" {
		return "", nil
	}
	c := yccrypt.NewYCCrypter(yccrypt.SetKey([]byte(phoneSecret)), yccrypt.SetSegment(10))
	crypt, err := c.PhoneCryptHex(phoneItem)
	if err != nil {
		return "", err
	}
	return crypt, nil
}

func YcPhoneEncrypt(phone string) (string, error) {
	if phone == "" || len(phone) != 11 {
		return "", nil
	}
	c := yccrypt.NewYCCrypter(yccrypt.SetKey([]byte(phoneSecret)), yccrypt.SetSegment(10))
	crypt, err := c.PhoneCryptHex(phone)
	if err != nil {
		return "", err
	}
	return crypt, nil
}

func YcPhoneDecrypt(crypt string) (string, error) {
	if len(crypt) == 0 {
		return "", nil
	}
	c := yccrypt.NewYCCrypter(yccrypt.SetKey([]byte(phoneSecret)), yccrypt.SetSegment(10))
	phone, err := c.SearchableDecryptHex(crypt)
	if err != nil {
		return "", err
	}
	return phone, nil
}

func YcCardEncrypt(card string) (string, error) {
	c := yccrypt.NewYCCrypter(yccrypt.SetKey([]byte(cardSecret)), yccrypt.SetSegment(10))
	crypt, err := c.SearchableCryptHex(card)
	if err != nil {
		return "", err
	}
	return crypt, nil
}

func YcCardDecrypt(crypt string) (string, error) {
	if len(crypt) == 0 {
		return "", nil
	}
	c := yccrypt.NewYCCrypter(yccrypt.SetKey([]byte(cardSecret)), yccrypt.SetSegment(10))
	phone, err := c.SearchableDecryptHex(crypt)
	if err != nil {
		return "", err
	}
	return phone, nil
}

func YcUserNameEncrypt(username string) (string, error) {
	c := yccrypt.NewYCCrypter(yccrypt.SetKey([]byte(otherSecret)), yccrypt.SetSegment(10))
	crypt, err := c.SearchableCryptHex(username)
	if err != nil {
		return "", err
	}
	return crypt, nil
}

func YcUserNameDecrypt(crypt string) (string, error) {
	if len(crypt) == 0 {
		return "", nil
	}
	c := yccrypt.NewYCCrypter(yccrypt.SetKey([]byte(otherSecret)), yccrypt.SetSegment(10))
	phone, err := c.SearchableDecryptHex(crypt)
	if err != nil {
		return "", err
	}
	return phone, nil
}
